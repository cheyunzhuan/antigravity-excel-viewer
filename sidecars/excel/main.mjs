// Sidecar backend for the Excel Preview panel.

import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'parse_excel.py');
const SUPPORTED_EXTS = new Set(['.xlsx', '.xlsm', '.xltx', '.xltm', '.csv', '.tsv']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.cache']);
const MAX_FILES = 250;
const MAX_DEPTH = 8;

const app = new SidecarApp();

function run(cmd, args, timeout = 25000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, {
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).trim()));
      else resolve(stdout);
    });
  });
}

function uriToPath(uri) {
  if (!uri) return '';
  if (!uri.startsWith('file:')) return uri;
  let p = decodeURIComponent(uri.replace(/^file:\/\//, ''));
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  return p;
}

function expandHome(p) {
  if (!p) return '';
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

function scanWorkspace(rootPath) {
  const results = [];
  if (!rootPath || !existsSync(rootPath)) return results;

  function walk(dir, depth) {
    if (depth > MAX_DEPTH || results.length >= MAX_FILES) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= MAX_FILES) break;
      const name = entry.name;
      if (name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(join(dir, name), depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(name).toLowerCase();
        if (SUPPORTED_EXTS.has(ext) && !name.startsWith('~$')) {
          const full = join(dir, name);
          try {
            const st = statSync(full);
            results.push({
              name,
              relPath: relative(rootPath, full) || name,
              path: full,
              size: st.size,
              mtimeMs: st.mtimeMs,
            });
          } catch { /* ignore unreadable */ }
        }
      }
    }
  }

  walk(rootPath, 0);
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results;
}

app.page('/', () => new Response(readFileSync(join(HERE, 'index.html'), 'utf8'), { contentType: 'text/html; charset=utf-8' }));

app.api('/api/files', async (data) => {
  try {
    let uris = [];
    if (data.workspaces) {
      try { uris = JSON.parse(data.workspaces); } catch { uris = [data.workspaces]; }
    } else if (data.workspace) {
      uris = [data.workspace];
    }
    const seen = new Set();
    const files = [];
    for (const uri of uris) {
      const root = uriToPath(uri);
      for (const f of scanWorkspace(root)) {
        if (!seen.has(f.path)) {
          seen.add(f.path);
          files.push(f);
        }
      }
    }
    // Also include recent spreadsheets in ~/Downloads
    const downloadsDir = join(homedir(), 'Downloads');
    if (existsSync(downloadsDir)) {
      try {
        for (const entry of readdirSync(downloadsDir, { withFileTypes: true })) {
          if (!entry.isFile() || entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
          if (!SUPPORTED_EXTS.has(extname(entry.name).toLowerCase())) continue;
          const full = join(downloadsDir, entry.name);
          if (seen.has(full)) continue;
          try {
            const st = statSync(full);
            seen.add(full);
            files.push({ name: entry.name, relPath: `Downloads/${entry.name}`, path: full, size: st.size, mtimeMs: st.mtimeMs });
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return { files };
  } catch (err) {
    return { error: err.message, files: [] };
  }
}, 'GET');

app.api('/api/preview', async (data) => {
  try {
    const filePath = expandHome((data.path || '').trim());
    if (!filePath) return { error: '请先选择或输入表格文件路径' };
    if (!existsSync(filePath)) return { error: `找不到文件: ${filePath}` };
    const st = statSync(filePath);
    const args = [SCRIPT, '--file', filePath, '--max-rows', String(Number(data.maxRows) || 500)];
    if (data.sheet) args.push('--sheet', data.sheet);
    const out = await run('python3', args);
    return { ...JSON.parse(out), mtimeMs: st.mtimeMs };
  } catch (err) {
    return { error: err.message };
  }
}, 'GET');

app.api('/api/open', async (data) => {
  try {
    const filePath = expandHome((data.path || '').trim());
    if (!filePath || !existsSync(filePath)) return { error: '文件不存在' };
    if (process.platform === 'darwin') {
      await run('open', [filePath], 5000);
    } else if (process.platform === 'win32') {
      await run('cmd', ['/c', 'start', '', filePath], 5000);
    } else {
      await run('xdg-open', [filePath], 5000);
    }
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}, 'POST');

app.api('/api/reveal', async (data) => {
  try {
    const filePath = expandHome((data.path || '').trim());
    if (!filePath || !existsSync(filePath)) return { error: '文件不存在' };
    if (process.platform === 'darwin') {
      await run('open', ['-R', filePath], 5000);
    } else if (process.platform === 'win32') {
      await run('explorer', [`/select,${filePath}`], 5000);
    } else {
      await run('xdg-open', [dirname(filePath)], 5000);
    }
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}, 'POST');

app.run();
