import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const statusPath = join(process.cwd(), 'vvu-trust', 'guardian', 'status.json');
    if (!existsSync(statusPath)) {
      return NextResponse.json({
        present: false,
        armCommand: 'python3 .zscripts/daemonize.py --cwd /home/z/my-project --pidfile .zscripts/guardian.pid --log .zscripts/guardian.log -- python3 .zscripts/guardian.py',
      });
    }
    const raw = readFileSync(statusPath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      present: false,
      armCommand: 'python3 .zscripts/daemonize.py -- python3 .zscripts/guardian.py',
    });
  }
}
