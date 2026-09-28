#!/usr/bin/env node
import { fileIo, run } from './run.ts';

process.exitCode = run(process.argv.slice(2), fileIo);
