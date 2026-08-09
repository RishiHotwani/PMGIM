import { execSync } from 'child_process';

/**
 * Automatically frees the target port by terminating any orphan process holding it.
 * Works on Windows, macOS, and Linux.
 */
export function freePort(port) {
  try {
    if (process.platform === 'win32') {
      execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING') do taskkill /f /pid %a`, { stdio: 'ignore', shell: 'cmd.exe' });
    } else {
      execSync(`lsof -t -i:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {
    // No process was holding the port or process already exited
  }
}
