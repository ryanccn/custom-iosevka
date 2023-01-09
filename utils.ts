import { writeAll } from 'https://deno.land/std@0.171.0/streams/write_all.ts';
import { dim, red, yellow } from 'https://deno.land/std@0.171.0/fmt/colors.ts';

export const CI = !!Deno.env.get('CI');

export const exists = async (path: string) => {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
};

export const exec = async (command: string[]) => {
  console.log(dim('$ ' + command.join(' ')));
  const p = Deno.run({
    cmd: command,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const { success, code } = await p.status();

  if (!success) {
    console.error(red(`Command failed with code ${code}`));
    Deno.exit(1);
  }
};

export const gitClone = async (repo: string, dir: string) => {
  if (await exists(dir)) {
    console.warn(yellow(`Skipping ${dir} (already exists)`));
    return;
  }

  await exec([
    'git',
    'clone',
    repo,
    dir,
    '--depth',
    '1',
  ]);
};

export const downloadReleaseAsset = async (
  repo: string,
  pattern: string,
  destination: string,
) => {
  const a = await fetch(
    `https://api.github.com/repos/${repo}/releases`,
  ).then((r) => r.json());

  const latest: string =
    a[0].assets.filter((b: { name: string }) => b.name.includes(pattern))[0]
      .browser_download_url;

  if (!latest) throw new Error('Not found!');

  const response = await fetch(latest).then((r) => r.body);
  if (!response) throw new Error('Not found!');

  const file = await Deno.open(destination, {
    create: true,
    write: true,
  });

  for await (const chunk of response) {
    await writeAll(file, chunk);
  }

  file.close();
};
