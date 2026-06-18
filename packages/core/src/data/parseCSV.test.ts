import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvToMatrix, coerce } from './parseCSV';

describe('parseCsvToMatrix', () => {
  it('parses basic comma-separated rows into a string matrix', () => {
    const text = 'a,b,c\n1,2,3\n4,5,6';
    expect(parseCsvToMatrix(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('returns raw string cells without any type coercion', () => {
    const text = 'x\ntrue\n42';
    expect(parseCsvToMatrix(text)).toEqual([['x'], ['true'], ['42']]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsvToMatrix('')).toEqual([]);
  });

  it('handles a single field with no delimiters or newlines', () => {
    expect(parseCsvToMatrix('hello')).toEqual([['hello']]);
  });

  it('preserves empty fields between delimiters', () => {
    expect(parseCsvToMatrix('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('handles a trailing delimiter as a trailing empty field', () => {
    expect(parseCsvToMatrix('a,b,')).toEqual([['a', 'b', '']]);
  });

  describe('quoted fields', () => {
    it('keeps embedded commas inside quotes as part of the field', () => {
      const text = 'name,note\n"Smith, John",hello';
      expect(parseCsvToMatrix(text)).toEqual([
        ['name', 'note'],
        ['Smith, John', 'hello'],
      ]);
    });

    it('keeps embedded newlines inside quotes as part of the field', () => {
      const text = 'a,b\n"line1\nline2",second';
      expect(parseCsvToMatrix(text)).toEqual([
        ['a', 'b'],
        ['line1\nline2', 'second'],
      ]);
    });

    it('keeps embedded CRLF inside quotes as a literal newline-bearing field', () => {
      // Inside quotes, characters are taken verbatim (CR/LF not normalized).
      const text = 'a\n"x\r\ny"';
      expect(parseCsvToMatrix(text)).toEqual([['a'], ['x\r\ny']]);
    });

    it('unescapes a doubled double-quote into a single quote', () => {
      const text = 'q\n"she said ""hi"""';
      expect(parseCsvToMatrix(text)).toEqual([['q'], ['she said "hi"']]);
    });

    it('handles a field that is entirely a quoted empty string', () => {
      const text = 'a,b\n"",x';
      expect(parseCsvToMatrix(text)).toEqual([
        ['a', 'b'],
        ['', 'x'],
      ]);
    });

    it('handles only doubled quotes inside quotes ("""")', () => {
      const text = '""""';
      expect(parseCsvToMatrix(text)).toEqual([['"']]);
    });
  });

  describe('line endings', () => {
    it('normalizes CRLF line endings', () => {
      const text = 'a,b\r\n1,2\r\n3,4';
      expect(parseCsvToMatrix(text)).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('normalizes lone CR line endings', () => {
      const text = 'a,b\r1,2\r3,4';
      expect(parseCsvToMatrix(text)).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('treats a trailing newline as no extra row', () => {
      expect(parseCsvToMatrix('a,b\n1,2\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('treats a trailing CRLF as no extra row', () => {
      expect(parseCsvToMatrix('a,b\r\n1,2\r\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });
  });

  it('honors a custom delimiter', () => {
    const text = 'a;b;c\n1;2;3';
    expect(parseCsvToMatrix(text, { delimiter: ';' })).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('honors a custom quote character', () => {
    const text = "name\n'Smith, John'";
    expect(parseCsvToMatrix(text, { quote: "'" })).toEqual([['name'], ['Smith, John']]);
  });
});

describe('coerce', () => {
  it('returns the raw string unchanged when dynamicTyping is disabled', () => {
    expect(coerce('42', false)).toBe('42');
    expect(coerce('true', false)).toBe('true');
    expect(coerce('', false)).toBe('');
    expect(coerce('null', false)).toBe('null');
  });

  it('coerces blank to null', () => {
    expect(coerce('', true)).toBeNull();
  });

  it('coerces the literal null (case-insensitive) to null', () => {
    expect(coerce('null', true)).toBeNull();
    expect(coerce('NULL', true)).toBeNull();
    expect(coerce('Null', true)).toBeNull();
  });

  it('coerces boolean literals (case-insensitive)', () => {
    expect(coerce('true', true)).toBe(true);
    expect(coerce('TRUE', true)).toBe(true);
    expect(coerce('false', true)).toBe(false);
    expect(coerce('False', true)).toBe(false);
  });

  it('coerces integer, decimal, signed, and exponent numbers', () => {
    expect(coerce('42', true)).toBe(42);
    expect(coerce('-3.5', true)).toBe(-3.5);
    expect(coerce('+7', true)).toBe(7);
    expect(coerce('.5', true)).toBe(0.5);
    expect(coerce('10.', true)).toBe(10);
    expect(coerce('1e3', true)).toBe(1000);
    expect(coerce('2.5E-2', true)).toBe(0.025);
    expect(coerce('0', true)).toBe(0);
  });

  it('does not coerce thousands-separated or otherwise non-numeric strings', () => {
    expect(coerce('1,234', true)).toBe('1,234');
    expect(coerce('1.2.3', true)).toBe('1.2.3');
    expect(coerce('12px', true)).toBe('12px');
    expect(coerce('abc', true)).toBe('abc');
  });

  it('leaves ordinary strings untouched', () => {
    expect(coerce('Germany', true)).toBe('Germany');
  });
});

describe('parseCsv', () => {
  it('parses rows into records using the header row by default', () => {
    const text = 'country,revenue\nGermany,100\nFrance,200';
    expect(parseCsv(text)).toEqual([
      { country: 'Germany', revenue: 100 },
      { country: 'France', revenue: 200 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns an empty array when only a header row is present', () => {
    expect(parseCsv('a,b,c')).toEqual([]);
  });

  describe('dynamicTyping (default on)', () => {
    it('coerces numbers, booleans, null, and blanks', () => {
      const text = 'n,b,nul,blank,str\n42,true,null,,hello';
      expect(parseCsv(text)).toEqual([
        { n: 42, b: true, nul: null, blank: null, str: 'hello' },
      ]);
    });

    it('coerces false correctly', () => {
      const text = 'flag\nfalse';
      expect(parseCsv(text)).toEqual([{ flag: false }]);
    });
  });

  describe('dynamicTyping disabled', () => {
    it('keeps every cell as a string, including blanks', () => {
      const text = 'n,b,blank,str\n42,true,,hello';
      expect(parseCsv(text, { dynamicTyping: false })).toEqual([
        { n: '42', b: 'true', blank: '', str: 'hello' },
      ]);
    });
  });

  describe('header option', () => {
    it('generates column1..columnN names when header is false', () => {
      const text = 'Germany,100\nFrance,200';
      expect(parseCsv(text, { header: false })).toEqual([
        { column1: 'Germany', column2: 100 },
        { column1: 'France', column2: 200 },
      ]);
    });

    it('treats the first row as data when header is false', () => {
      const text = 'a,b\n1,2';
      expect(parseCsv(text, { header: false })).toEqual([
        { column1: 'a', column2: 'b' },
        { column1: 1, column2: 2 },
      ]);
    });
  });

  describe('trim option', () => {
    it('trims whitespace around headers and values by default', () => {
      const text = ' country , revenue \n  Germany ,  100  ';
      expect(parseCsv(text)).toEqual([{ country: 'Germany', revenue: 100 }]);
    });

    it('preserves whitespace when trim is disabled', () => {
      const text = ' country , revenue \n  Germany ,  100  ';
      // Keys keep surrounding spaces; values stay as raw strings then coerced.
      // "  100  " is not a clean numeric string, so it stays a string.
      expect(parseCsv(text, { trim: false })).toEqual([
        { ' country ': '  Germany ', ' revenue ': '  100  ' },
      ]);
    });

    it('coerces a trimmed numeric value to a number', () => {
      const text = 'revenue\n  100  ';
      expect(parseCsv(text)).toEqual([{ revenue: 100 }]);
    });
  });

  describe('quoting in records', () => {
    it('preserves embedded commas and unescapes doubled quotes in values', () => {
      const text = 'name,note\n"Smith, John","say ""hi"""';
      expect(parseCsv(text)).toEqual([
        { name: 'Smith, John', note: 'say "hi"' },
      ]);
    });

    it('preserves embedded newlines in quoted values', () => {
      const text = 'a,b\n"line1\nline2",x';
      expect(parseCsv(text)).toEqual([{ a: 'line1\nline2', b: 'x' }]);
    });
  });

  describe('trailing newline / empty lines', () => {
    it('does not emit an empty record for a trailing newline', () => {
      const text = 'country,revenue\nGermany,100\n';
      const records = parseCsv(text);
      expect(records).toHaveLength(1);
      expect(records).toEqual([{ country: 'Germany', revenue: 100 }]);
    });

    it('does not emit an empty record for a trailing CRLF', () => {
      const text = 'country,revenue\r\nGermany,100\r\n';
      const records = parseCsv(text);
      expect(records).toHaveLength(1);
      expect(records).toEqual([{ country: 'Germany', revenue: 100 }]);
    });
  });

  describe('ragged rows', () => {
    it('fills missing trailing cells with null (blank coerced)', () => {
      const text = 'a,b,c\n1,2';
      expect(parseCsv(text)).toEqual([{ a: 1, b: 2, c: null }]);
    });

    it('ignores extra cells beyond the header count', () => {
      const text = 'a,b\n1,2,3';
      expect(parseCsv(text)).toEqual([{ a: 1, b: 2 }]);
    });
  });

  describe('line endings in records', () => {
    it('parses CRLF-delimited records', () => {
      const text = 'a,b\r\n1,2\r\n3,4';
      expect(parseCsv(text)).toEqual([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
    });

    it('parses lone-CR-delimited records', () => {
      const text = 'a,b\r1,2\r3,4';
      expect(parseCsv(text)).toEqual([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
    });
  });
});
