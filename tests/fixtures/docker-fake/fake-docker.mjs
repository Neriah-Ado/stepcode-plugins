#!/usr/bin/env node
// fake docker CLI（仅测试用）：按参数输出 canned 结果；down 执行时写 DOCKER_MATE_DOWN_MARKER 标记文件用于 G3 验证
import { appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
const marker = process.env.DOCKER_MATE_DOWN_MARKER;
const out = (lines) => process.stdout.write(lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');

if (args[0] === 'version') {
  out(['24.0.0']);
} else if (args[0] === 'ps') {
  out([
    { ID: 'aaa111', Names: 'demo-web', Image: 'demo/web:latest', State: 'exited', Status: 'Exited (137) 2 minutes ago', Ports: '' },
    { ID: 'bbb222', Names: 'demo-api', Image: 'demo/api:latest', State: 'running', Status: 'Up 10 minutes', Ports: '0.0.0.0:8080->8080/tcp' },
    { ID: 'ccc333', Names: 'demo-db', Image: 'postgres:16', State: 'running', Status: 'Up 10 minutes', Ports: '5432/tcp' },
  ]);
} else if (args[0] === 'inspect') {
  const name = args[1] ?? '';
  if (name.includes('web')) {
    out([JSON.stringify([{ Name: '/demo-web', Config: { Image: 'demo/web:latest' }, State: { Status: 'exited', ExitCode: 137, OOMKilled: true, Error: '' }, RestartCount: 3, Mounts: [{ Source: '/data/web', Destination: '/var/www' }] }])]);
  } else {
    out([JSON.stringify([{ Name: `/${name}`, Config: { Image: 'demo/other:latest' }, State: { Status: 'running', ExitCode: 0, OOMKilled: false, Error: '' }, RestartCount: 0, Mounts: [] }])]);
  }
} else if (args[0] === 'logs') {
  const lines = [];
  for (let i = 1; i <= 250; i += 1) lines.push(`line-${i} app working`);
  lines.push('FATAL ERROR: Reached heap limit - Allocation failed - JavaScript heap out of memory');
  out(lines);
} else if (args[0] === 'compose' && args[1] === '-f') {
  const rest = args.slice(3);
  if (rest[0] === 'ps') {
    out([
      { Name: 'demo-web', Service: 'web', State: 'exited' },
      { Name: 'demo-api', Service: 'api', State: 'running' },
      { Name: 'demo-db', Service: 'db', State: 'running' },
    ]);
  } else if (rest[0] === 'up') {
    out(['Container demo-db  Started', 'Container demo-api  Started', 'Container demo-web  Started']);
  } else if (rest[0] === 'down') {
    if (marker) appendFileSync(marker, `down:${args[2]}:${rest.includes('-v')}\n`);
    out(['Container demo-web  Removed', 'Container demo-api  Removed', 'Container demo-db  Removed']);
  } else {
    process.exit(1);
  }
} else if (args[0] === 'compose' && args[1] === 'ls') {
  out([{ Name: 'demo-app', Status: 'running(3)', Configfiles: 'C:/work/demo/compose.yaml' }]);
} else if (args[0] === 'history') {
  out([
    { Size: '320MB', CreatedBy: 'COPY node_modules /app/node_modules # buildkit' },
    { Size: '45MB', CreatedBy: 'COPY src /app/src # buildkit' },
    { Size: '12MB', CreatedBy: 'RUN apt-get install -y curl vim' },
    { Size: '2.4MB', CreatedBy: 'COPY package.json /app/' },
    { Size: '0B', CreatedBy: 'WORKDIR /app' },
  ]);
} else {
  process.exit(1);
}
