#!/usr/bin/env node
/**
 * The electron-builder afterPack hook: flips the Electron fuses on the
 * packaged binary. The fuse settings live here because electron-builder has
 * no `fuses` config key - they are part of the build, applied right after
 * the app is packed.
 *
 * Usage: wired up through `afterPack` in electron-builder.yml.
 */

import { FuseVersion, FuseV1Options, flipFuses } from '@electron/fuses';
import { join } from 'node:path';

export default async function afterPack(context) {
    const productName = context.packager.appInfo.productFilename;
    const binary =
        process.platform === 'darwin'
            ? join(context.appOutDir, `${productName}.app`, 'Contents', 'MacOS', productName)
            : process.platform === 'win32'
              ? join(context.appOutDir, `${productName}.exe`)
              : join(context.appOutDir, productName);

    await flipFuses(binary, {
        version: FuseVersion.V1,
        // Flipping invalidates the ad-hoc signature, and macOS arm64 does
        // not boot a modified binary without one.
        resetAdHocDarwinSignature: process.platform === 'darwin',
        // The Electron security checklist. Flip one of these and the
        // packaged app no longer behaves like the app that was tested.
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false
    });
}
