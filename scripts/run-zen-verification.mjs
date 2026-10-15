import { build } from 'rolldown';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output=join(tmpdir(),'orbit-zen-certificates.mjs');
await build({input:'scripts/verify-zen-certificates.ts',output:{file:output,format:'esm'},external:['node:fs']});
const result=spawnSync(process.execPath,[output,...process.argv.slice(2)],{stdio:'inherit'});
process.exit(result.status??1);
