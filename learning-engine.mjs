const TOKEN = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[()+\-*/^]/y;
const MAX_EXPRESSION_LENGTH = 240;
const MAX_TOKEN_COUNT = 120;

function tokenize(source) {
  if (typeof source !== 'string' || !source.trim() || source.length > MAX_EXPRESSION_LENGTH) {
    throw new Error('Enter an equation with at most 240 characters.');
  }
  const tokens = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    TOKEN.lastIndex = cursor;
    const match = TOKEN.exec(source);
    if (!match) throw new Error(`Unsupported character at position ${cursor + 1}.`);
    tokens.push(match[0]);
    cursor = TOKEN.lastIndex;
    if (tokens.length > MAX_TOKEN_COUNT) throw new Error('Equation has too many parts.');
  }
  return tokens;
}

export function evaluateExpression(source, variables = {}) {
  const tokens = tokenize(source);
  const values = new Map();
  for (const [name, value] of Object.entries(variables || {})) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(`Variable ${name} must be a finite number.`);
    values.set(name.toLowerCase(), numeric);
  }
  values.set('pi', Math.PI);
  values.set('e', Math.E);

  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  function parsePrimary() {
    const token = consume();
    if (token === undefined) throw new Error('Expected a number or variable.');
    if (token === '(') {
      const result = parseAddSub();
      if (consume() !== ')') throw new Error('Missing closing parenthesis.');
      return result;
    }
    if (/^(?:\d|\.)/.test(token)) {
      const numeric = Number(token);
      if (!Number.isFinite(numeric)) throw new Error('Number is outside the supported range.');
      return numeric;
    }
    if (/^[A-Za-z]/.test(token)) {
      const name = token.toLowerCase();
      if (!values.has(name)) throw new Error(`Unknown variable: ${token}.`);
      return values.get(name);
    }
    throw new Error(`Unexpected token: ${token}.`);
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek() === '^') {
      consume();
      return base ** parseUnary();
    }
    return base;
  }

  function parseUnary() {
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    return parsePower();
  }

  function parseMulDiv() {
    let result = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const operator = consume();
      const right = parseUnary();
      if (operator === '/' && right === 0) throw new Error('Division by zero is undefined.');
      result = operator === '*' ? result * right : result / right;
    }
    return result;
  }

  function parseAddSub() {
    let result = parseMulDiv();
    while (peek() === '+' || peek() === '-') {
      const operator = consume();
      const right = parseMulDiv();
      result = operator === '+' ? result + right : result - right;
    }
    return result;
  }

  const result = parseAddSub();
  if (index !== tokens.length) throw new Error(`Unexpected token: ${tokens[index]}.`);
  if (!Number.isFinite(result)) throw new Error('The result is outside the supported range.');
  return result;
}

export const physicsFormulas = [
  {
    id: 'speed',
    label: 'Average speed',
    formula: 'distance / time',
    unit: 'm/s',
    inputs: [
      { key: 'distance', label: 'Distance', unit: 'm' },
      { key: 'time', label: 'Time', unit: 's' }
    ]
  },
  {
    id: 'force',
    label: 'Net force',
    formula: 'mass * acceleration',
    unit: 'N',
    inputs: [
      { key: 'mass', label: 'Mass', unit: 'kg' },
      { key: 'acceleration', label: 'Acceleration', unit: 'm/s^2' }
    ]
  },
  {
    id: 'weight',
    label: 'Weight near Earth',
    formula: 'mass * gravity',
    unit: 'N',
    defaults: { gravity: 9.80665 },
    inputs: [{ key: 'mass', label: 'Mass', unit: 'kg' }]
  },
  {
    id: 'kinetic-energy',
    label: 'Kinetic energy',
    formula: '0.5 * mass * velocity^2',
    unit: 'J',
    inputs: [
      { key: 'mass', label: 'Mass', unit: 'kg' },
      { key: 'velocity', label: 'Velocity', unit: 'm/s' }
    ]
  },
  {
    id: 'potential-energy',
    label: 'Gravitational potential energy',
    formula: 'mass * gravity * height',
    unit: 'J',
    defaults: { gravity: 9.80665 },
    inputs: [
      { key: 'mass', label: 'Mass', unit: 'kg' },
      { key: 'height', label: 'Height', unit: 'm' }
    ]
  },
  {
    id: 'density',
    label: 'Density',
    formula: 'mass / volume',
    unit: 'kg/m^3',
    inputs: [
      { key: 'mass', label: 'Mass', unit: 'kg' },
      { key: 'volume', label: 'Volume', unit: 'm^3' }
    ]
  }
];

export function calculatePhysics(formulaId, inputValues) {
  const formula = physicsFormulas.find(item => item.id === formulaId);
  if (!formula) throw new Error('Choose a supported physics relationship.');
  const variables = { ...formula.defaults };
  for (const input of formula.inputs) {
    const value = Number(inputValues && inputValues[input.key]);
    if (!Number.isFinite(value)) throw new Error(`${input.label} must be a finite number.`);
    variables[input.key] = value;
  }
  const value = evaluateExpression(formula.formula, variables);
  return { label: formula.label, formula: formula.formula, value, unit: formula.unit };
}