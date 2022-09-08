import { exec, gitClone } from './exec.ts';
import { join } from 'https://deno.land/std@0.154.0/path/mod.ts';
import { bold, green } from 'https://deno.land/std@0.154.0/fmt/colors.ts';

{
  try {
    await Deno.stat('work/');
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      await Deno.mkdir('work/');
    }
  }

  Deno.chdir('work/');
}

await gitClone('https://github.com/be5invis/Iosevka.git', 'iosevka');
await gitClone('https://github.com/ryanoasis/nerd-fonts.git', 'nerd-fonts');

await Deno.copyFile(
  '../private-build-plans.toml',
  'iosevka/private-build-plans.toml',
);

Deno.chdir('iosevka');
await exec(['npm', 'ci']);
await exec(['npm', 'run', 'build', '--', 'ttf::ryans-iosevka']);

Deno.chdir('../nerd-fonts');

const ORIGINAL_TTF_DIR = '../iosevka/dist/ryans-iosevka/ttf';

for await (
  const originalTTF of Deno.readDir(ORIGINAL_TTF_DIR)
) {
  console.log(bold(`Processing ${originalTTF.name}`));

  if (originalTTF.isFile && originalTTF.name.endsWith('.ttf')) {
    await exec([
      'fontforge',
      '-script',
      'font-patcher',
      join(ORIGINAL_TTF_DIR, originalTTF.name),
      '--careful',
      '--fontawesome',
      '--octicons',
      '--powerline',
      '--powerlineextra',
      '--fontawesome',
      '--fontawesomeextension',
      '--quiet',
      '--output',
      '../build',
    ]);
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

await exec(['zip', '-r', '../ryans-iosevka.zip', '.']);

Deno.chdir('..');
