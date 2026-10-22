import { calculatePhysics, evaluateExpression, physicsFormulas } from './learning-engine.mjs';

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function parseVariables(source) {
  const variables = {};
  const text = source.trim();
  if (!text) return variables;
  for (const assignment of text.split(',')) {
    const match = assignment.trim().match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/);
    if (!match) throw new Error('Enter variables as comma-separated name=value pairs.');
    variables[match[1]] = Number(match[2]);
  }
  return variables;
}

function mountLearningEngine() {
  if (!document.body || document.getElementById('hl-learning-engine')) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./learning-engine-ui.css', import.meta.url).href;
  document.head.appendChild(stylesheet);

  const panel = createElement('aside', 'hl-engine-panel');
  panel.id = 'hl-learning-engine';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Math and Physics Engine');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;

  const panelHeader = createElement('header', 'hl-engine-header');
  const panelTitle = createElement('h2', 'hl-engine-title', 'Math and Physics Engine');
  const closeButton = document.createElement('button');
  closeButton.className = 'hl-engine-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close Math and Physics Engine');
  closeButton.title = 'Close engine';
  closeButton.textContent = 'Close';
  panelHeader.append(panelTitle, closeButton);

  const toggleButton = document.createElement('button');
  toggleButton.className = 'hl-engine-toggle';
  toggleButton.type = 'button';
  toggleButton.setAttribute('aria-controls', panel.id);

  const sliderLabel = createElement('label', 'hl-engine-slide-label', 'Slide engine panel');
  sliderLabel.htmlFor = 'hl-engine-slide';
  const panelSlider = document.createElement('input');
  panelSlider.id = 'hl-engine-slide';
  panelSlider.className = 'hl-engine-slide';
  panelSlider.type = 'range';
  panelSlider.min = '0';
  panelSlider.max = '100';
  panelSlider.step = '5';
  panelSlider.value = '0';
  panelSlider.setAttribute('aria-label', 'Slide Math and Physics Engine into view');
  sliderLabel.appendChild(panelSlider);
  const sliderValue = createElement('output', 'hl-engine-slide-value', '0%');
  sliderValue.setAttribute('aria-live', 'polite');

  const setPanelProgress = value => {
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    panelSlider.value = String(progress);
    sliderValue.textContent = `${progress}%`;
    panel.setAttribute('aria-hidden', String(progress === 0));
    panel.inert = progress === 0;
    panel.style.right = `${-panel.offsetWidth * (1 - progress / 100)}px`;
    panel.style.transform = 'none';
    panel.style.visibility = 'visible';
    panel.style.pointerEvents = progress === 0 ? 'none' : 'auto';
    toggleButton.setAttribute('aria-expanded', String(progress > 0));
    toggleButton.textContent = progress > 0 ? 'Close Math and Physics Engine' : 'Open Math and Physics Engine';
  };

  toggleButton.addEventListener('click', () => setPanelProgress(Number(panelSlider.value) > 0 ? 0 : 100));
  closeButton.addEventListener('click', () => {
    setPanelProgress(0);
    toggleButton.focus();
  });
  panelSlider.addEventListener('input', () => setPanelProgress(panelSlider.value));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setPanelProgress(0);
      toggleButton.focus();
    }
  });
  const content = createElement('div', 'hl-engine-content');
  const modeLabel = createElement('label', 'hl-engine-label', 'Calculator');
  const modeSelect = document.createElement('select');
  modeSelect.className = 'hl-engine-control';
  modeSelect.setAttribute('aria-label', 'Choose engine calculator');
  const expressionOption = new Option('Equation', 'expression');
  const physicsOption = new Option('Physics', 'physics');
  modeSelect.add(expressionOption);
  modeSelect.add(physicsOption);
  modeLabel.appendChild(modeSelect);

  const expressionForm = document.createElement('form');
  expressionForm.className = 'hl-engine-form';
  const equationLabel = createElement('label', 'hl-engine-label', 'Equation');
  const equationInput = document.createElement('input');
  equationInput.className = 'hl-engine-control';
  equationInput.type = 'text';
  equationInput.maxLength = 240;
  equationInput.autocomplete = 'off';
  equationInput.spellcheck = false;
  equationInput.placeholder = '2 * (3 + 4)';
  equationInput.setAttribute('aria-label', 'Equation to evaluate');
  equationLabel.appendChild(equationInput);

  const variablesLabel = createElement('label', 'hl-engine-label', 'Variables');
  const variablesInput = document.createElement('input');
  variablesInput.className = 'hl-engine-control';
  variablesInput.type = 'text';
  variablesInput.maxLength = 240;
  variablesInput.autocomplete = 'off';
  variablesInput.placeholder = 'mass=3, acceleration=4';
  variablesInput.setAttribute('aria-label', 'Equation variables');
  variablesLabel.appendChild(variablesInput);
  expressionForm.append(equationLabel, variablesLabel);

  const physicsForm = document.createElement('form');
  physicsForm.className = 'hl-engine-form';
  physicsForm.hidden = true;
  const physicsLabel = createElement('label', 'hl-engine-label', 'Relationship');
  const physicsSelect = document.createElement('select');
  physicsSelect.className = 'hl-engine-control';
  physicsSelect.setAttribute('aria-label', 'Choose a physics formula');
  for (const formula of physicsFormulas) physicsSelect.add(new Option(formula.label, formula.id));
  physicsLabel.appendChild(physicsSelect);
  const physicsInputs = createElement('div', 'hl-engine-inputs');
  const physicsFields = new Map();
  const renderPhysicsInputs = () => {
    physicsInputs.replaceChildren();
    physicsFields.clear();
    const formula = physicsFormulas.find(item => item.id === physicsSelect.value);
    for (const field of formula.inputs) {
      const label = createElement('label', 'hl-engine-label', `${field.label} (${field.unit})`);
      const input = document.createElement('input');
      input.className = 'hl-engine-control';
      input.type = 'number';
      input.step = 'any';
      input.required = true;
      input.name = field.key;
      input.setAttribute('aria-label', `${field.label} in ${field.unit}`);
      physicsFields.set(field.key, input);
      label.appendChild(input);
      physicsInputs.appendChild(label);
    }
  };
  physicsSelect.addEventListener('change', renderPhysicsInputs);
  renderPhysicsInputs();
  physicsForm.append(physicsLabel, physicsInputs);

  const output = createElement('p', 'hl-engine-output', 'Enter an equation or choose a physics relationship.');
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  const evaluateButton = document.createElement('button');
  evaluateButton.className = 'hl-engine-button';
  evaluateButton.type = 'button';
  evaluateButton.textContent = 'Calculate';

  modeSelect.addEventListener('change', () => {
    const expressionMode = modeSelect.value === 'expression';
    expressionForm.hidden = !expressionMode;
    physicsForm.hidden = expressionMode;
    output.textContent = 'Enter values and calculate.';
  });
  evaluateButton.addEventListener('click', () => {
    try {
      if (modeSelect.value === 'expression') {
        const value = evaluateExpression(equationInput.value, parseVariables(variablesInput.value));
        output.textContent = `Result: ${Number(value.toPrecision(10))}`;
      } else {
        const values = Object.fromEntries([...physicsFields].map(([key, input]) => [key, input.value]));
        const result = calculatePhysics(physicsSelect.value, values);
        output.textContent = `${result.label}: ${Number(result.value.toPrecision(8))} ${result.unit}  |  ${result.formula}`;
      }
    } catch (error) {
      output.textContent = error.message;
    }
  });

  content.append(modeLabel, expressionForm, physicsForm, evaluateButton, output);
  panel.append(panelHeader, content);
  document.body.append(panel, toggleButton, sliderLabel, sliderValue);
  setPanelProgress(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountLearningEngine, { once: true });
} else {
  mountLearningEngine();
}