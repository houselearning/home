(function () {
  const questionRows = {
    math: [
      ['4 counters and 1 more make how many?', '5', '4', '6', '3'],
      ['Which shape has three sides?', 'Triangle', 'Circle', 'Square', 'Rectangle'],
      ['Which number is greater?', '4', '2', '0', '1'],
      ['A red-blue pattern repeats. What follows red, blue, red?', 'Blue', 'Red', 'Green', 'Yellow'],
      ['What is 10 + 5?', '15', '14', '16', '5'],
      ['What is 18 - 7?', '11', '10', '12', '25'],
      ['How many sides does a rectangle have?', '4', '3', '5', '6'],
      ['Which is a way to compare lengths?', 'Use the same-sized units', 'Change the object shape', 'Count colors', 'Ignore the starting point'],
      ['What is 38 + 24?', '62', '52', '64', '58'],
      ['What is 4 groups of 3?', '12', '7', '9', '15'],
      ['Half an hour is how many minutes?', '30', '15', '45', '60'],
      ['How many cents are in one quarter?', '25', '10', '5', '50'],
      ['What is 7 x 6?', '42', '36', '48', '13'],
      ['What is 24 divided by 4?', '6', '8', '4', '20'],
      ['What fraction means 3 of 4 equal parts?', '3/4', '4/3', '1/4', '3/8'],
      ['A rectangle is 3 by 4 units. What is its perimeter?', '14 units', '12 units', '7 units', '24 units'],
      ['Which fraction is equivalent to 1/2?', '2/4', '1/3', '3/5', '2/3'],
      ['What is 3/8 + 2/8?', '5/8', '5/16', '1/8', '6/8'],
      ['What is 0.7 written as a fraction in tenths?', '7/10', '7/100', '70/1', '1/7'],
      ['Which number is a factor of 24?', '6', '5', '7', '11'],
      ['What is 3.4 + 1.2?', '4.6', '4.2', '3.6', '5.6'],
      ['What is 3/4 of 20?', '15', '12', '16', '17'],
      ['In which quadrant is the point (2, 3)?', 'Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'],
      ['A box is 2 by 3 by 4 units. What is its volume?', '24 cubic units', '9 cubic units', '24 square units', '12 cubic units'],
      ['What is the value of the ratio 8:4 as a unit rate?', '2 to 1', '4 to 1', '1 to 2', '12 to 1'],
      ['What is -3 + 8?', '5', '-5', '11', '-11'],
      ['What is 25% of 40?', '10', '15', '20', '5'],
      ['Solve x + 7 = 19.', '12', '26', '11', '13'],
      ['A proportional relationship has constant of proportionality 3. What is y when x = 4?', '12', '7', '1', '16'],
      ['What is 3/4 - 1/8?', '5/8', '2/8', '1/2', '7/8'],
      ['A 20 dollar item is discounted 15%. What is the discount?', '3 dollars', '5 dollars', '15 dollars', '17 dollars'],
      ['Which equation describes a line with slope 2 and y-intercept 3?', 'y = 2x + 3', 'y = 3x + 2', 'y = 2x - 3', 'y = x + 5'],
      ['Solve 3x - 5 = 10.', '5', '3', '15', '-5'],
      ['What is the slope between (1, 2) and (3, 6)?', '2', '4', '1/2', '3'],
      ['A right triangle has legs 6 and 8. What is its hypotenuse?', '10', '12', '14', '8'],
      ['Which transformation preserves lengths and angle measures?', 'Rotation', 'Dilation by 2', 'Stretch', 'Enlargement'],
      ['What is the solution to x + 4 = 11?', '7', '15', '4', '8'],
      ['For f(x) = 2x + 1, what is f(3)?', '7', '6', '5', '9'],
      ['Which expression is equivalent to 3(x + 2)?', '3x + 6', '3x + 2', 'x + 6', '5x'],
      ['What is the vertex form of a quadratic function?', 'a(x - h)^2 + k', 'ax + b', 'a/x', 'a(x + h)'],
      ['If f(x) = x^2, what is f(-3)?', '9', '-9', '6', '-6'],
      ['Which equation represents a circle centered at the origin with radius 5?', 'x^2 + y^2 = 25', 'x + y = 5', 'x^2 - y^2 = 25', 'xy = 25'],
      ['What does congruent mean for two figures?', 'Same shape and same size', 'Same area only', 'Same orientation only', 'Same perimeter only'],
      ['In a right triangle, sin(theta) equals which ratio?', 'Opposite over hypotenuse', 'Adjacent over hypotenuse', 'Opposite over adjacent', 'Hypotenuse over opposite'],
      ['What is the derivative of x^2?', '2x', 'x', '2', 'x^3'],
      ['What does a definite integral represent geometrically?', 'Signed area over an interval', 'The slope at one point', 'A function input', 'A sequence term'],
      ['Which is the magnitude of vector (3, 4)?', '5', '7', '12', '1'],
      ['What is the common ratio of 3, 6, 12, 24?', '2', '3', '6', '4'],
      ['What is the derivative of x^3?', '3x^2', 'x^2', '3x', 'x^4'],
      ['What is an antiderivative of 2x?', 'x^2 + C', '2x^2 + C', '2 + C', 'x + C'],
      ['What is the dot product of (1, 2) and (3, 4)?', '11', '10', '14', '5'],
      ['A geometric sequence starts 5, 15, 45. What is its common ratio?', '3', '5', '10', '15']
    ],
    cs: [
      ['What is an algorithm?', 'A sequence of steps to solve a problem', 'A computer screen', 'A storage cable', 'A type of battery'],
      ['What does debugging mean?', 'Finding and fixing errors', 'Deleting every file', 'Turning off a device', 'Changing screen brightness'],
      ['In a sequence 2, 4, 6, what comes next?', '8', '7', '9', '10'],
      ['Which is an example of input?', 'A key pressed on a keyboard', 'A speaker playing sound', 'A printed page', 'A screen displaying a result'],
      ['What does a loop do in a program?', 'Repeats instructions', 'Deletes variables', 'Stops all input', 'Changes hardware'],
      ['What is a variable used for?', 'Store a value that a program can use', 'Display a web page only', 'Connect to electricity', 'Replace every function'],
      ['What does a conditional do?', 'Chooses actions based on a test', 'Repeats forever by definition', 'Stores an image', 'Renames the computer'],
      ['What is binary?', 'A number system using 0 and 1', 'A two-page website', 'A file backup', 'A programming error'],
      ['What does an array commonly store?', 'An ordered collection of values', 'Only one fixed character', 'A screen layout', 'A network address only'],
      ['What is a function?', 'A named reusable block of instructions', 'A kind of monitor', 'A random error', 'A folder permission'],
      ['What does a Boolean value represent?', 'True or false', 'Any image file', 'A list of names only', 'A decimal number only'],
      ['What is a test case?', 'An input and expected behavior used to check software', 'A user password', 'A design color', 'An installation folder'],
      ['What is the purpose of an abstraction?', 'Hide unnecessary detail while keeping key behavior', 'Make every detail visible at once', 'Remove all input validation', 'Prevent reuse'],
      ['What is the worst-case time complexity of linear search?', 'O(n)', 'O(1)', 'O(log n)', 'O(n^2)'],
      ['Which structure follows last-in, first-out order?', 'Stack', 'Queue', 'Tree traversal', 'Hash table'],
      ['What does an API define?', 'A contract for software components to communicate', 'A screen resolution', 'A loop counter', 'A compression format'],
      ['What is a database primary key for?', 'Uniquely identify a row', 'Encrypt every network packet', 'Style a table', 'Repeat a query'],
      ['What is a race condition?', 'A result depends on unpredictable operation timing', 'A slow algorithm by definition', 'An invalid variable name', 'A database schema'],
      ['Which Git operation records a snapshot in repository history?', 'Commit', 'Clone', 'Fetch', 'Ignore'],
      ['What does HTML primarily describe?', 'The structure and meaning of web content', 'The behavior of a server process', 'A database query', 'Image compression'],
      ['What is recursion?', 'A function solving a problem by calling itself on smaller cases', 'A loop with no condition', 'A database index', 'A CSS selector'],
      ['What is a hash function commonly used for?', 'Map input data to a fixed-size value', 'Sort every list', 'Create a user interface', 'Compress source code losslessly always'],
      ['What does normalization reduce in relational database design?', 'Unnecessary duplication and update anomalies', 'The number of valid queries to zero', 'The need for keys', 'All stored relationships'],
      ['What is a good reason to use an interface or abstraction?', 'Separate callers from implementation details', 'Make all fields public', 'Duplicate every algorithm', 'Remove type checks'],
      ['What does Big-O notation describe?', 'How resource use grows with input size', 'The exact runtime on one computer', 'The number of source files', 'The programming language version'],
      ['Why use automated tests in a software project?', 'Check behavior repeatedly and catch regressions', 'Replace all design decisions', 'Guarantee zero defects', 'Avoid reviewing changes'],
      ['What is a database transaction expected to provide?', 'A reliable unit of work with defined consistency behavior', 'A visual page layout', 'A programming language parser', 'An operating-system theme'],
      ['What does a compiler generally do?', 'Translate source code into another representation such as machine code', 'Store images in a database', 'Manage a queue of user requests', 'Format web styles'],
      ['What is a pure function?', 'A function with no observable side effects and same output for same input', 'A function that uses global state', 'A function that always returns null', 'A function that modifies its arguments'],
      ['What does an HTTP status code describe?', 'The result of a web request', 'A variable type', 'A Git branch', 'A database primary key'],
      ['What is a useful property of a well-designed module?', 'High cohesion and clear boundaries', 'Many unrelated responsibilities', 'Hidden dependencies everywhere', 'No tests or documentation'],
      ['What does a digital signature help verify?', 'Authenticity and integrity of signed data', 'Data display color', 'Algorithmic runtime', 'Database normalization'],
      ['Which approach helps protect a program from SQL injection?', 'Use parameterized queries', 'Concatenate untrusted input into SQL', 'Disable database constraints', 'Expose database errors to everyone'],
      ['What is a distributed system?', 'Components on multiple networked machines cooperate', 'A single local variable', 'A static image format', 'A CPU instruction only'],
      ['Why are invariants useful in algorithm design?', 'They state properties that remain true through execution', 'They remove the need for inputs', 'They guarantee constant time', 'They replace all tests'],
      ['What does a queue typically use?', 'First-in, first-out order', 'Last-in, first-out order', 'Random access only', 'Sorted order by default'],
      ['What does a version-control branch allow?', 'Independent line of development', 'Automatic deletion of history', 'Encryption of all source code', 'A substitute for testing'],
      ['What is a race condition?', 'Concurrent operations produce timing-dependent behavior', 'A compiler optimization', 'A valid sorting algorithm', 'A database backup'],
      ['What does a database index trade for faster lookup?', 'Additional storage and update work', 'Data integrity', 'All query functionality', 'Primary keys'],
      ['What does a software license specify?', 'Terms for using, modifying, and distributing software', 'The algorithm output', 'The CPU speed', 'The file encoding'],
      ['What is a threat model used to identify?', 'Assets, attackers, and possible attack paths', 'User-interface colors', 'Compiler warnings only', 'Database table count'],
      ['What does a build pipeline automate?', 'Steps such as compiling, testing, and packaging', 'Only user interviews', 'Only database normalization', 'Hardware manufacturing'],
      ['What is the purpose of code review?', 'Find issues and improve clarity before changes are integrated', 'Guarantee code never fails', 'Replace the test suite', 'Hide design decisions'],
      ['Which characteristic is essential to a cryptographic hash?', 'Small input changes produce a hard-to-predict digest change', 'It can always be reversed efficiently', 'It preserves the original file size', 'It sorts the input'],
      ['What is a distributed consensus protocol for?', 'Help nodes agree on system state under stated assumptions', 'Render web content', 'Compile a local function', 'Normalize a table'],
      ['What does a continuous integration system usually do?', 'Build and test proposed changes automatically', 'Replace source control', 'Design the product alone', 'Guarantee every deployment is secure'],
      ['Why use profiling before optimizing?', 'Measure actual performance bottlenecks', 'Make code longer', 'Avoid defining expected behavior', 'Remove observability'],
      ['What does a service-level objective describe?', 'A target for a measurable service reliability outcome', 'An algorithm input', 'A CSS layout rule', 'A database field type'],
      ['What is a deadlock in concurrent software?', 'Processes wait indefinitely for resources held by one another', 'A successful database backup', 'A fast sorting method', 'A compiler warning'],
      ['What does amortized analysis estimate?', 'Average operation cost across a sequence of operations', 'The exact runtime of one execution', 'The number of programming languages', 'The size of a source file'],
      ['What do public-key cryptographic systems use?', 'A related public key and private key', 'One shared public password only', 'A database index and query', 'Two identical private keys'],
      ['What is a load balancer designed to do?', 'Distribute work across available service instances', 'Encrypt source code', 'Compile each request', 'Replace all application tests']
    ],
    science: [
      ['Which is a living thing?', 'A growing plant', 'A rock', 'A glass cup', 'A cloud'],
      ['What do living things need to grow?', 'Resources such as water and energy', 'Only sunlight for every organism', 'No matter or energy', 'A computer'],
      ['Which state of matter has a fixed shape?', 'Solid', 'Liquid', 'Gas', 'Plasma only'],
      ['What causes day and night on Earth?', 'Earth rotates', 'The Moon turns off the Sun', 'The Sun circles Earth each day', 'Clouds block half the planet'],
      ['Which body part is used for hearing?', 'Ear', 'Elbow', 'Knee', 'Foot'],
      ['Where does a fish usually live?', 'In water', 'In dry sand', 'Inside a tree', 'In outer space'],
      ['What happens when water freezes?', 'It becomes solid ice', 'It becomes a gas', 'It disappears', 'It becomes a metal'],
      ['What can a simple machine help do?', 'Change the size or direction of a force', 'Create matter', 'Stop gravity', 'Remove all friction'],
      ['What do plants need for photosynthesis?', 'Light, water, and carbon dioxide', 'Only soil', 'Oxygen and darkness only', 'Rock and salt'],
      ['What is a habitat?', 'A place where an organism lives', 'A type of weather instrument', 'A rock layer', 'A food molecule'],
      ['What is the main energy source for most food chains?', 'The Sun', 'The Moon', 'Earths core only', 'Sound waves'],
      ['What does a force do?', 'Can change an objects motion', 'Always increases temperature', 'Creates energy from nothing', 'Changes a solid into a gas every time'],
      ['Which is an example of a physical change?', 'Ice melting', 'Iron rusting', 'Wood burning', 'Food digesting'],
      ['What does an ecosystem include?', 'Organisms and their environment interacting', 'Only one animal', 'Only nonliving rocks', 'A single food chain with no surroundings'],
      ['What is erosion?', 'Movement of weathered material', 'Formation of sunlight', 'A type of cell division', 'The creation of new atoms'],
      ['What is inherited information carried in DNA?', 'Instructions related to traits', 'A measure of force', 'A type of weather', 'A form of sound'],
      ['What is one role of decomposers?', 'Break down dead matter and recycle nutrients', 'Produce sunlight', 'Stop all energy transfer', 'Make rocks from air'],
      ['What happens to particles when a substance is heated?', 'They generally move faster', 'They stop moving', 'They turn into energy only', 'They lose all mass'],
      ['What do chemical reactions rearrange?', 'Atoms and their bonds', 'Planets and stars', 'Only the color of light', 'The number of protons in every atom'],
      ['What is a variable in an experiment?', 'A factor that is changed, measured, or controlled', 'A conclusion before collecting data', 'A source citation', 'A scientific law'],
      ['What does natural selection describe?', 'How heritable traits affecting reproduction can change in populations', 'How individuals choose their genes', 'How rocks become living', 'How organisms stop evolving'],
      ['What is the function of a cell membrane?', 'Regulate movement into and out of the cell', 'Store all genetic information in every cell', 'Produce gravity', 'Make the cell wall in animals'],
      ['What is a chemical bond?', 'An attraction that holds atoms together', 'A force between planets only', 'A type of weathering', 'An organism interaction'],
      ['What does conservation of mass mean in a closed chemical reaction?', 'Total mass remains constant', 'Reactants disappear without products', 'Atoms change into energy completely', 'Products must weigh more'],
      ['What is acceleration?', 'Change in velocity over time', 'Distance divided by area', 'Mass multiplied by volume', 'Energy stored in a bond'],
      ['Which quantity is measured in newtons?', 'Force', 'Mass', 'Temperature', 'Time'],
      ['What is an independent variable?', 'The factor intentionally changed in an investigation', 'The response measured', 'A factor held constant', 'A repeated measurement'],
      ['What does a scientific model help explain?', 'A system and patterns in observations', 'Every detail of reality perfectly', 'Only opinions', 'Results without evidence'],
      ['What is a gene?', 'A segment of DNA associated with a functional product or trait', 'A complete ecosystem', 'A type of force', 'A chemical reaction'],
      ['What does pH describe?', 'How acidic or basic a solution is', 'The speed of a reaction only', 'The mass of an atom', 'The frequency of a wave'],
      ['What is an allele?', 'A version of a gene', 'A type of cell membrane', 'A chemical bond', 'A population'],
      ['What is a catalyst?', 'A substance that changes reaction rate without being consumed overall', 'A product that must be used up', 'A measure of acidity', 'A source of matter'],
      ['What is an exothermic reaction?', 'A reaction that releases energy to its surroundings', 'A reaction that absorbs no energy', 'A reaction with no products', 'A physical change only'],
      ['Why does a population evolve rather than an individual?', 'Evolution is a change in inherited trait frequencies across generations', 'Individuals never change during life', 'Populations do not reproduce', 'Genes cannot be inherited'],
      ['What does an energy diagram show?', 'Energy changes during a process or reaction', 'Only the number of organisms', 'A map of continents', 'The shape of a cell'],
      ['What is a feedback loop in a system?', 'A process where output influences later system behavior', 'A one-way list of observations', 'A type of chemical element', 'A control group'],
      ['What is momentum?', 'Mass multiplied by velocity', 'Force divided by time', 'Energy multiplied by distance', 'Acceleration divided by mass'],
      ['What is electromagnetic induction?', 'A changing magnetic field can produce an electric effect', 'A chemical bond forms from sound', 'A planet reflects heat', 'A cell creates a magnetic pole'],
      ['What is a controlled experiment designed to do?', 'Compare outcomes while limiting alternative explanations', 'Change every factor at once', 'Guarantee a favored outcome', 'Avoid measuring results'],
      ['What does a confidence interval estimate?', 'A range of plausible values for a population parameter', 'The exact value of every sample', 'A measurement with no uncertainty', 'A chemical equilibrium'],
      ['What is a derivative in a physical model often interpreted as?', 'An instantaneous rate of change', 'A total accumulated quantity', 'A constant input', 'A probability sample'],
      ['What does an integral often represent in an accumulation model?', 'Accumulated change over an interval', 'An instantaneous slope only', 'A genetic variation', 'A chemical element'],
      ['What is a feedback mechanism in climate science?', 'A change that reinforces or counteracts an initial change', 'A single weather event', 'A type of mineral', 'A laboratory instrument'],
      ['What is homeostasis?', 'Regulation that helps maintain internal conditions', 'A change in inherited allele frequency', 'A chemical reaction rate', 'A force acting on a planet'],
      ['What does a statistical correlation alone establish?', 'Association, not necessarily causation', 'A direct causal mechanism', 'No relationship can exist', 'That the data are error-free'],
      ['What is a limiting reactant?', 'The reactant that limits the amount of product formed', 'The catalyst in every reaction', 'The most massive product', 'A solvent only'],
      ['What does uncertainty in a measurement communicate?', 'The range or precision associated with the measured value', 'That the measurement is useless', 'The exact true value', 'The number of trials only'],
      ['What is a scientific theory?', 'A well-supported explanatory framework', 'An unsupported guess', 'A single data point', 'A law that cannot be tested'],
      ['What does genetic drift describe?', 'Random changes in allele frequencies in a population', 'A directed change in an individual gene', 'Movement of matter through a food chain', 'The speed of a chemical reaction'],
      ['What is entropy commonly associated with in thermodynamics?', 'The dispersal of energy and number of possible microscopic states', 'The total mass of a sample only', 'The speed of an object', 'The acidity of a solution'],
      ['What is radiometric dating based on?', 'Predictable radioactive decay over time', 'Daily changes in weather', 'The current population size', 'The color of a mineral only'],
      ['What is a climate feedback?', 'A process that amplifies or reduces an initial climate change', 'A single weather measurement', 'A change in one organisms behavior', 'A type of laboratory control']
    ]
  };

  const gradeQuestionOverrides = {
    science: {
      10: [
        ['What does a balanced chemical equation conserve?', 'The number of each type of atom', 'The number of molecules only', 'The temperature only', 'The volume of every substance'],
        ['What is the limiting reactant?', 'The reactant that limits how much product can form', 'The product with the smallest mass', 'A catalyst used to start a reaction', 'A reactant left over in excess'],
        ['What does one mole represent?', 'About 6.022 x 10^23 particles', 'One gram of every substance', 'One liter of every gas', 'Exactly 100 particles'],
        ['At room temperature, a solution with pH 3 is generally what?', 'Acidic', 'Neutral', 'Basic', 'A pure metal']
      ]
    }
  };
  const subjectNames = { math: 'Mathematics', cs: 'Computer science', science: 'Science' };
  const params = new URLSearchParams(location.search);
  const subjectSelect = document.getElementById('subject-select');
  const gradeSelect = document.getElementById('grade-select');
  const startButton = document.getElementById('start-test');
  const workspace = document.getElementById('test-workspace');
  const title = document.getElementById('test-title');
  const description = document.getElementById('test-description');
  const requestedSubject = params.get('subject');
  const requestedGrade = params.get('grade');
  if (Object.hasOwn(subjectNames, requestedSubject)) subjectSelect.value = requestedSubject;
  if (/^(?:0|[1-9]|1[0-2])$/.test(requestedGrade || '')) gradeSelect.value = requestedGrade;
  updateTitle();
  subjectSelect.addEventListener('change', updateTitle);
  gradeSelect.addEventListener('change', updateTitle);
  startButton.addEventListener('click', startTest);

  function updateTitle() {
    const grade = Number(gradeSelect.value);
    const gradeName = gradeSelect.value === '' ? 'Select grade' : grade === 0 ? 'Kindergarten' : `Grade ${grade}`;
    title.textContent = `${gradeName} ${subjectNames[subjectSelect.value]} Unit Test`;
    description.textContent = gradeSelect.value === ''
      ? 'Choose a grade to begin a four-question review of core ideas.'
      : 'Four questions review core ideas from this subject and grade. A score of 3 out of 4 demonstrates a passing result.';
    startButton.disabled = gradeSelect.value === '';
  }

  function startTest() {
    const subject = subjectSelect.value;
    const grade = Number(gradeSelect.value);
    const firstQuestion = grade * 4;
    const questions = gradeQuestionOverrides[subject]?.[grade] || questionRows[subject].slice(firstQuestion, firstQuestion + 4);
    const testQuestions = questions.map((row, index) => ({
      prompt: row[0],
      answer: row[1],
      options: shuffle(row.slice(1)),
      number: index + 1
    }));
    let index = 0;
    let score = 0;
    let answered = false;
    renderQuestion();

    function renderQuestion() {
      answered = false;
      workspace.replaceChildren();
      const panel = document.createElement('section');
      panel.className = 'question-panel';
      const progress = document.createElement('div');
      progress.className = 'progress-track';
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.style.width = `${(index / testQuestions.length) * 100}%`;
      progress.appendChild(bar);
      const count = document.createElement('p');
      count.className = 'question-count';
      count.textContent = `Question ${index + 1} of ${testQuestions.length}`;
      const prompt = document.createElement('h2');
      prompt.textContent = testQuestions[index].prompt;
      const answerList = document.createElement('div');
      answerList.className = 'answer-list';
      const feedback = document.createElement('p');
      feedback.className = 'feedback';
      const actions = document.createElement('div');
      actions.className = 'question-actions';
      const next = document.createElement('button');
      next.className = 'primary-button';
      next.type = 'button';
      next.textContent = index === testQuestions.length - 1 ? 'See results' : 'Next question';
      next.disabled = true;
      next.addEventListener('click', () => {
        if (!answered) return;
        index++;
        if (index === testQuestions.length) renderResult();
        else renderQuestion();
      });
      testQuestions[index].options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'answer-option';
        button.type = 'button';
        button.textContent = option;
        button.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          const correct = option === testQuestions[index].answer;
          if (correct) score++;
          answerList.querySelectorAll('button').forEach(item => { item.disabled = true; });
          button.setAttribute('aria-pressed', 'true');
          feedback.classList.add(correct ? 'correct' : 'incorrect');
          feedback.textContent = correct ? 'Correct.' : `Not quite. The correct answer is ${testQuestions[index].answer}.`;
          next.disabled = false;
        });
        answerList.appendChild(button);
      });
      actions.appendChild(next);
      panel.append(progress, count, prompt, answerList, feedback, actions);
      workspace.appendChild(panel);
    }

    function renderResult() {
      workspace.replaceChildren();
      const panel = document.createElement('section');
      panel.className = 'result-panel';
      const heading = document.createElement('h2');
      heading.textContent = score >= 3 ? 'Unit test complete' : 'Keep practicing';
      const result = document.createElement('p');
      result.className = 'result-score';
      result.textContent = `${score} / ${testQuestions.length}`;
      const message = document.createElement('p');
      message.textContent = score >= 3 ? 'Passing result. You demonstrated a strong grasp of the grade-level ideas.' : 'Review the lesson material and retry the unit test. A score of 3 out of 4 is passing.';
      const actions = document.createElement('div');
      actions.className = 'result-actions';
      const retry = document.createElement('button');
      retry.className = 'primary-button';
      retry.type = 'button';
      retry.textContent = 'Retake test';
      retry.addEventListener('click', startTest);
      actions.appendChild(retry);
      panel.append(heading, result, message, actions);
      workspace.appendChild(panel);
    }
  }

  function shuffle(items) {
    return items.map(value => ({ value, key: Math.random() })).sort((left, right) => left.key - right.key).map(item => item.value);
  }
})();