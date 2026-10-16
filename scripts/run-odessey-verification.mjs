import { build } from 'rolldown';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output=join(tmpdir(),'orbit-odessey-certificates.mjs');
await build({input:'scripts/verify-odessey-certificates.ts',output:{file:output,format:'esm'},external:['node:fs']});
const result=spawnSync(process.execPath,[output,...process.argv.slice(2)],{stdio:'inherit'});
process.exit(result.status??1);
