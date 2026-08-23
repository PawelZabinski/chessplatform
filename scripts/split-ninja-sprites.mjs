import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const assets = [
	['IdleNinja.png', 352, 32],
	['RunNinja.png', 384, 32],
	['JumpNinja.png', 32, 32],
	['DoubleJumpNinja.png', 192, 32]
];

// The three opaque reds used by the authored headband. Matching the palette
// exactly keeps the split lossless: no frog, outfit, or transparent pixel can
// be mistaken for fabric.
const headbandColours = new Set(['228,74,74', '204,48,72', '156,27,77']);

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { encoding: null, ...options });
	if (result.status !== 0) {
		throw new Error(`${command} failed:\n${result.stderr?.toString() ?? ''}`);
	}
	return result.stdout;
}

function encode(path, width, height, pixels) {
	run(
		'ffmpeg',
		[
			'-v',
			'error',
			'-f',
			'rawvideo',
			'-pixel_format',
			'rgba',
			'-video_size',
			`${width}x${height}`,
			'-i',
			'pipe:0',
			'-frames:v',
			'1',
			'-y',
			path
		],
		{ input: pixels }
	);
}

function decode(path) {
	return run('ffmpeg', [
		'-v',
		'error',
		'-i',
		path,
		'-f',
		'rawvideo',
		'-pixel_format',
		'rgba',
		'pipe:1'
	]);
}

for (const [file, width, height] of assets) {
	const sourcePath = join('static', 'assets', file);
	const headbandPath = join(dirname(sourcePath), `${basename(file, '.png')}Headband.png`);
	const pixels = decode(sourcePath);
	const expectedBytes = width * height * 4;
	if (pixels.length !== expectedBytes) {
		throw new Error(`${file}: expected ${expectedBytes} RGBA bytes, received ${pixels.length}`);
	}

	// Once split, reconstructing the authored composite from the two layers makes
	// the generator safe to run again after either layer has been hand-edited.
	if (existsSync(headbandPath)) {
		const previousHeadband = decode(headbandPath);
		if (previousHeadband.length !== expectedBytes) {
			throw new Error(`${headbandPath}: unexpected dimensions`);
		}
		for (let i = 0; i < pixels.length; i += 4) {
			if (previousHeadband[i + 3] !== 0) previousHeadband.copy(pixels, i, i, i + 4);
		}
	}

	const base = Buffer.from(pixels);
	const headband = Buffer.alloc(expectedBytes);
	let extracted = 0;
	for (let i = 0; i < pixels.length; i += 4) {
		const colour = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
		if (pixels[i + 3] !== 0 && headbandColours.has(colour)) {
			pixels.copy(headband, i, i, i + 4);
			base.fill(0, i, i + 4);
			extracted += 1;
		}
	}
	if (extracted === 0) throw new Error(`${file}: no headband pixels found`);

	encode(sourcePath, width, height, base);
	encode(headbandPath, width, height, headband);
	console.log(`${file}: extracted ${extracted} headband pixels`);
}
