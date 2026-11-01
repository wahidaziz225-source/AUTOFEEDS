import { spawn } from 'child_process';
import path from 'path';

export * from './creative-styles-data';

export interface VariantItem {
  index: number;
  filename: string;
  filepath: string;
  url: string;
  style_id: string;
  style_name: string;
  composition: string;
  headline: string;
  format: string;
}

export interface CarouselSlideItem {
  slide: number;
  title: string;
  filename: string;
  filepath: string;
  url: string;
  badge: string;
}

export async function runCreativeStudioPython(params: Record<string, unknown>): Promise<any> {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'creative_studio.py');
  const jsonArg = JSON.stringify(params);

  return new Promise((resolve, reject) => {
    const pythonExe = process.env.PYTHON_BIN || 'python';
    const proc = spawn(pythonExe, [scriptPath, '--json', jsonArg]);

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[CreativeStudio Python Error]', stderrData);
        return reject(new Error(`Creative Studio gagal memproses desain (exit ${code}): ${stderrData || stdoutData}`));
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (err) {
        // Fallback: look for last JSON line in stdout
        const lines = stdoutData.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const p = JSON.parse(lines[i]);
            return resolve(p);
          } catch {
            // continue
          }
        }
        reject(new Error(`Gagal mengurai respons Python: ${stdoutData}`));
      }
    });
  });
}
