# A quick action is a saved utterance

Amends ADR 0014: the Quick actions section sits between General and the
tile sections.

The row above the ask bar offers quick actions: a label and an utterance,
stored as `brooz.quick-actions` and edited in their own settings section
right after General. A click puts the utterance into the field, where the
rules - and the local model, once the person enabled it - route it like a
typed one; the suggestion row names the arguments found ("Flight LH123"),
and Enter summons. There are at most 8; the label is optional, the
utterance is not.

Until the person changes the list, it is derived from the registry: the
first example of every routed tile with a live version. The first change
stores the whole list, and from then on only that list counts - an emptied
list stays empty, and a tile added in a later release does not join it.

## Considered options

- A fixed target (a tile and its arguments) that summons directly:
  rejected - it would skip the routing, so nothing would show which tile
  and which arguments the bar recognized, and the stored shape would bind
  to the tile ids and the argument kinds of today.
- Summon on click: rejected - the person would never see the recognized
  arguments before the tile opens; one Enter is the price.
- Merge new tiles' defaults into a list the person made: rejected - a list
  that changes by itself after an update is not the person's list, and an
  emptied list would fill up again.

## Consequences

- The local model stays opt-in; a quick action needs nothing the typed
  utterance does not.
- A stored list outlives tile renames: an utterance that no longer routes
  matches no tile, and the person edits it in the settings.
