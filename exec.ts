import { dim, red, yellow } from 'https://deno.land/std@0.154.0/fmt/colors.ts';

const exists = async (path: string) => {
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
  const p = Deno.run({ cmd: command, stdout: 'inherit', stderr: 'inherit' });
  const { success, code } = await p.status();

  if (!success) {
    console.error(red(`command failed with code ${code}`));
    Deno.exit(1);
  }
};

export const gitClone = async (repo: string, dir: string) => {
  if (await exists(dir)) {
    console.warn(yellow(`skipping ${dir} (already exists)`));
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
