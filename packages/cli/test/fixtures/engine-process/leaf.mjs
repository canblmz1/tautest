import { writeFileSync } from 'node:fs';

writeFileSync('leaf.pid', String(process.pid));
setInterval(() => writeFileSync('heartbeat', String(Date.now())), 30);
writeFileSync('leaf.ready', 'ready');
