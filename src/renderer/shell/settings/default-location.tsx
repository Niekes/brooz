import { useState } from 'react';
import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { GeoPlace } from '../../../shared/weather';
import { errorMessage, useDefaultLocation, useSurfSpot } from '../kit/hooks';
import { AppButton } from '../ui/app-button';
import { AppInput } from '../ui/app-input';

/** The saved place by name, and the buttons that replace or drop it. */
function SavedPlace({
    place,
    onChange,
    onClear
}: {
    place: GeoPlace;
    onChange: () => void;
    onClear: () => void;
}): JSX.Element {
    return (
        <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                {place.country ? `${place.name}, ${place.country}` : place.name}
            </span>
            <AppButton onClick={onChange}>Change</AppButton>
            <AppButton onClick={onClear}>Clear</AppButton>
        </div>
    );
}

/**
 * The field that takes a city. It is looked up once, on save, and the place
 * found is kept, so the person sees which Paris they got; nothing is kept
 * when the lookup finds none.
 */
function PlaceField({
    label,
    onSave,
    onCancel
}: {
    label: string;
    onSave: (place: GeoPlace) => void;
    onCancel: (() => void) | null;
}): JSX.Element {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    async function save(): Promise<void> {
        setBusy(true);
        setNotice(null);
        try {
            onSave(await window.brooz.invoke(IPC_CHANNELS.geocode, value.trim()));
        } catch (cause) {
            setNotice(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <AppInput
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="City"
                    aria-label={label}
                    disabled={busy}
                />
                <AppButton disabled={busy || value.trim().length === 0} onClick={() => void save()}>
                    Save
                </AppButton>
                {onCancel ? (
                    <AppButton disabled={busy} onClick={onCancel}>
                        Cancel
                    </AppButton>
                ) : null}
            </div>
            {notice !== null ? <p className="text-xs text-white/50">{notice}</p> : null}
        </>
    );
}

/** "latitude, longitude", the way a map copies a point. */
const COORDINATES = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * The coordinates of a saved place, to move it exactly. Both are saved at
 * once, so a move is one change; a value off the globe puts the saved one back.
 */
function Coordinates({
    place,
    setPlace
}: {
    place: GeoPlace;
    setPlace: (place: GeoPlace) => void;
}): JSX.Element {
    const shown = `${place.latitude}, ${place.longitude}`;
    return (
        <AppInput
            key={shown}
            aria-label="Coordinates"
            placeholder="Latitude, longitude"
            defaultValue={shown}
            onBlur={(event) => {
                const [, latitude, longitude] = (COORDINATES.exec(event.target.value) ?? []).map(
                    Number
                );
                if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
                    setPlace({ ...place, latitude, longitude });
                } else {
                    event.target.value = shown;
                }
            }}
        />
    );
}

/** A saved place, looked up by city, that a person can change or clear. */
function PlaceOption({
    title,
    description,
    label,
    place,
    setPlace,
    coordinates = false
}: {
    title: string;
    description: string;
    label: string;
    place: GeoPlace | null;
    setPlace: (place: GeoPlace | null) => void;
    /** The saved coordinates stay editable, to move the place exactly. */
    coordinates?: boolean;
}): JSX.Element {
    const [editing, setEditing] = useState(false);

    return (
        <div
            role="group"
            aria-label={title}
            className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm"
        >
            <span className="flex flex-col gap-1">
                <span className="text-white">{title}</span>
                <span className="text-xs text-white/50">{description}</span>
            </span>
            {place && !editing ? (
                <>
                    <SavedPlace
                        place={place}
                        onChange={() => setEditing(true)}
                        onClear={() => setPlace(null)}
                    />
                    {coordinates ? <Coordinates place={place} setPlace={setPlace} /> : null}
                </>
            ) : (
                <PlaceField
                    label={label}
                    onSave={(found) => {
                        setPlace(found);
                        setEditing(false);
                    }}
                    onCancel={place ? () => setEditing(false) : null}
                />
            )}
        </div>
    );
}

/**
 * The default location, shared by every tile that shows a place: where a
 * tile without a city looks when there is no device location.
 */
export function DefaultLocationOption(): JSX.Element {
    const [place, setPlace] = useDefaultLocation();
    return (
        <PlaceOption
            title="Default location"
            description="Where a tile without a city looks when there is no device location. Without one, the tile asks for a location."
            label="City of the default location"
            place={place}
            setPlace={setPlace}
        />
    );
}

/**
 * The surf spot: found by a town's name, then moved onto the water by its
 * coordinates. Saving it spends no Stormglass request.
 */
export function SurfSpotOption(): JSX.Element {
    const [spot, setSpot] = useSurfSpot();
    return (
        <PlaceOption
            title="Surf spot"
            description="Find the town, then paste the break's coordinates from a map: the forecast needs a point on the water."
            label="Town of the surf spot"
            place={spot}
            setPlace={setSpot}
            coordinates
        />
    );
}
