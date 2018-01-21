import MagicString from 'magic-string';
import { createFilter } from 'rollup-pluginutils';

function escapeStr(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

function functor(thing) {
	if (typeof thing === 'function') return thing;
	return () => thing;
}

function longest(a, b) {
	return b.length - a.length;
}

export default function replace(options = {}) {
	const filter = createFilter(options.include, options.exclude);
	const { delimiters, escape } = options;

	let values;

	if (options.values) {
		values = options.values;
	} else {
		values = Object.assign({}, options);
		delete values.delimiters;
		delete values.include;
		delete values.exclude;
		delete values.escape;
	}

	if (escape != null && !escape) {
		if (Object.keys(values).length > 1) {
			throw new Error('When escape is disabled only one value is allowed');
		}
	}

	let escapeFunc = (escape != null && !escape ? (str) => str : escapeStr);
	const keys = Object.keys(values).sort(longest).map(escapeFunc);

	const pattern = delimiters ?
		new RegExp(
			`${escapeFunc(delimiters[0])}(${keys.join('|')})${escapeFunc(delimiters[1])}`,
			'g'
		) :
		new RegExp(
			`\\b(${keys.join('|')})\\b`,
			'g'
		);

	// convert all values to functions
	Object.keys(values).forEach(key => {
		values[key] = functor(values[key]);
	});

	return {
		name: 'replace',

		transform(code, id) {
			if (!filter(id)) return null;

			const magicString = new MagicString(code);

			let hasReplacements = false;
			let match;
			let start, end, replacement;

			while ((match = pattern.exec(code))) {
				hasReplacements = true;

				start = match.index;
				end = start + match[0].length;
				if (escape != null && !escape) {
					replacement = String(Object.values(values)[0](id, match));
				} else {
					replacement = String(values[match[1]](id));
				}

				magicString.overwrite(start, end, replacement);
			}

			if (!hasReplacements) return null;

			let result = { code: magicString.toString() };
			if (options.sourceMap !== false && options.sourcemap !== false)
				result.map = magicString.generateMap({ hires: true });

			return result;
		}
	};
}
