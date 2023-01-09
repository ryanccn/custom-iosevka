import { CI, downloadReleaseAsset, exec, gitClone } from './utils.ts';

import { join } from 'https://deno.land/std@0.171.0/path/mod.ts';
import { bold, green } from 'https://deno.land/std@0.171.0/fmt/colors.ts';

console.log('Preparing...');

{
  try {
    await Deno.remove('work/', { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }

  await Deno.mkdir('work/');
  Deno.chdir('work/');
}

if (CI) {
  console.log('Installing FontForge...');
  await downloadReleaseAsset('fontforge/fontforge', 'AppImage', 'fontforge');
  await Deno.chmod('fontforge', 0o755);
}

console.log('Downloading Iosevka source...');
await gitClone('https://github.com/be5invis/Iosevka.git', 'iosevka');

console.log('Downloading Nerd Fonts Font Patcher...');
await downloadReleaseAsset(
  'ryanoasis/nerd-fonts',
  'FontPatcher.zip',
  'fontpatcher.zip',
);

await exec(['unzip', 'fontpatcher.zip', '-d', 'nerd-fonts']);

console.log('Building Iosevka...');

await Deno.copyFile(
  '../private-build-plans.toml',
  'iosevka/private-build-plans.toml',
);

Deno.chdir('iosevka');
await exec(['npm', 'ci']);
await exec(['npm', 'run', 'build', '--', 'ttf::ryans-iosevka']);

console.log('Patching in Nerd Fonts Symbols...');

Deno.chdir('../nerd-fonts');

const ORIGINAL_TTF_DIR = join(Deno.cwd(), '../iosevka/dist/ryans-iosevka/ttf');

for await (
  const originalTTF of Deno.readDir(ORIGINAL_TTF_DIR)
) {
  console.log(bold(`Processing ${originalTTF.name}`));

  if (originalTTF.isFile && originalTTF.name.endsWith('.ttf')) {
    await exec([
      CI ? '../fontforge' : 'fontforge',
      '-script',
      join(Deno.cwd(), 'font-patcher'),
      join(ORIGINAL_TTF_DIR, originalTTF.name),
      '--careful',
      '--fontlogos',
      '--pomicons',
      '--material',
      '--powerline',
      '--powerlineextra',
      '--fontawesome',
      '--fontawesomeextension',
      '--octicons',
      '--powersymbols',
      '--weather',
      '--quiet',
      '--output',
      join(Deno.cwd(), '../build'),
    ]);

    console.log(`Patched ${originalTTF.name}`);
  }
}

Deno.chdir('../build');
for await (const patchedTTF of Deno.readDir('.')) {
  if (patchedTTF.isFile && patchedTTF.name.endsWith('.ttf')) {
    const original = patchedTTF.name;
    const newName = original.split(' ').slice(
      0,
      original.split(' ').indexOf('Nerd'),
    ).join(' ') + '.ttf';

    await Deno.rename(patchedTTF.name, newName);

    console.log(green(`Renamed ${original} to ${newName}`));
  }
}

console.log('Packaging...');

await exec(['zip', '-r', '../../ryans-iosevka.zip', '.']);

Deno.chdir('../..');
if (CI) await Deno.remove('work', { recursive: true });

console.log('Done!');
