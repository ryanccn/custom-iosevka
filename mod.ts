import { exec, gitClone } from './exec.ts';
import { join } from 'https://deno.land/std@0.154.0/path/mod.ts';
import { bold, green } from 'https://deno.land/std@0.154.0/fmt/colors.ts';
import { writeAll } from 'https://deno.land/std@0.156.0/streams/conversion.ts';

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

// Install FontForge via AppImage

{
  const a = await fetch(
    'https://api.github.com/repos/fontforge/fontforge/releases',
  ).then((r) => r.json());

  const latest: string =
    a[0].assets.filter((b: { name: string }) => b.name.includes('AppImage'))[0]
      .browser_download_url;

  const appImage = await fetch(latest).then((r) => r.body);
  if (!appImage) throw new Error('AppImage not found');

  const appImageFile = await Deno.open('fontforge', {
    create: true,
    write: true,
  });

  for await (const chunk of appImage) {
    await writeAll(appImageFile, chunk);
  }

  appImageFile.close();
  await Deno.chmod('fontforge', 0o755);
}

// Clone dependencies

await gitClone('https://github.com/be5invis/Iosevka.git', 'iosevka');
await gitClone('https://github.com/ryanoasis/nerd-fonts.git', 'nerd-fonts');

// Build Iosevka

await Deno.copyFile(
  '../private-build-plans.toml',
  'iosevka/private-build-plans.toml',
);

Deno.chdir('iosevka');
await exec(['npm', 'ci']);
await exec(['npm', 'run', 'build', '--', 'ttf::ryans-iosevka']);

// Patch with Nerd Fonts

Deno.chdir('../nerd-fonts');

const ORIGINAL_TTF_DIR = join(Deno.cwd(), '../iosevka/dist/ryans-iosevka/ttf');

for await (
  const originalTTF of Deno.readDir(ORIGINAL_TTF_DIR)
) {
  console.log(bold(`Processing ${originalTTF.name}`));

  if (originalTTF.isFile && originalTTF.name.endsWith('.ttf')) {
    await exec([
      '../fontforge',
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

// Packaging

await exec(['zip', '-r', '../ryans-iosevka.zip', '.']);

Deno.chdir('..');
