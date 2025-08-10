document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const dayBtn = document.getElementById('day-btn');
  const nightBtn = document.getElementById('night-btn');
  const autoBtn = document.getElementById('auto-btn');
  const lessonIframe = document.getElementById('lesson-iframe');
  const lessonLink = document.getElementById('lesson-link');

  // ----------------- Theme Switcher Logic -----------------
  const setPreference = (theme) => {
    if (theme === 'day') {
      body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'day');
    } else if (theme === 'night') {
      body.classList.add('dark-mode');
      localStorage.setItem('theme', 'night');
    } else {
      localStorage.removeItem('theme');
      checkSystemPreference();
    }
  };

  const checkSystemPreference = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
  };

  const updateButtons = (activeBtn) => {
    dayBtn.classList.remove('active');
    nightBtn.classList.remove('active');
    autoBtn.classList.remove('active');
    activeBtn.classList.add('active');
  };

  // Load theme preference on initial load
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'day') {
    setPreference('day');
    updateButtons(dayBtn);
  } else if (savedTheme === 'night') {
    setPreference('night');
    updateButtons(nightBtn);
  } else {
    checkSystemPreference();
    updateButtons(autoBtn);
  }

  dayBtn.addEventListener('click', () => {
    setPreference('day');
    updateButtons(dayBtn);
  });
  nightBtn.addEventListener('click', () => {
    setPreference('night');
    updateButtons(nightBtn);
  });
  autoBtn.addEventListener('click', () => {
    setPreference('auto');
    updateButtons(autoBtn);
  });

  // Listen for system theme changes in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        body.classList.add('dark-mode');
      } else {
        body.classList.remove('dark-mode');
      }
    }
  });
  // --------------------------------------------------------

  // ----------------- Lesson of the Day Logic -----------------
  const programmingLanguages = {
    'vbnet': ['vb-intro.html', 'vb-syntax.html', 'vb-variables.html', 'vb-conditions.html', 'vb-loops.html', 'vb-arrays.html', 'vb-functions.html', 'vb-oop.html', 'vb-exceptions.html', 'vb-fileio.html', 'vb-database.html', 'vb-winforms.html', 'vb-threads.html', 'vb-async.html'],
    'csharp': ['csharp-intro.html', 'csharp-syntax.html', 'csharp-variables.html', 'csharp-conditions.html', 'csharp-loops.html', 'csharp-arrays.html', 'csharp-functions.html', 'csharp-oop.html', 'csharp-exceptions.html', 'csharp-fileio.html', 'csharp-database.html', 'csharp-wpf.html', 'csharp-threads.html', 'csharp-async.html'],
    'python': ['py-intro.html', 'py-syntax.html', 'py-variables.html', 'py-loops.html', 'py-functions.html'],
    'java': ['java-intro.html', 'java-data-types.html', 'java-control-flow.html', 'java-arrays.html'],
    'ruby': ['ruby-intro.html', 'ruby-syntax.html', 'ruby-data-types.html'],
    'swift': ['swift-intro.html', 'swift-variables.html', 'swift-control-flow.html'],
    'kotlin': ['kotlin-intro.html', 'kotlin-data-types.html', 'kotlin-control-flow.html'],
    'go': ['go-intro.html', 'go-variables.html', 'go-control-flow.html'],
    'php': ['php-intro.html', 'php-syntax.html', 'php-variables.html'],
    'typescript': ['ts-intro.html', 'ts-data-types.html', 'ts-interfaces.html'],
    'r': ['r-intro.html', 'r-data-types.html', 'r-vectors.html'],
    'sql': ['sql-intro.html', 'sql-select.html', 'sql-where.html', 'sql-join.html'],
    'dart': ['dart-intro.html', 'dart-variables.html', 'dart-functions.html'],
    'matlab': ['matlab-intro.html', 'matlab-variables.html', 'matlab-functions.html'],
    'bash': ['bash-intro.html', 'bash-scripts.html', 'bash-variables.html'],
    'perl': ['perl-intro.html', 'perl-variables.html', 'perl-control-flow.html'],
    'cpp': ['cpp-intro.html', 'cpp-variables.html', 'cpp-control-flow.html', 'cpp-functions.html'],
    'json': ['json-intro.html', 'json-syntax.html'],
    'powershell': ['ps-intro.html', 'ps-commands.html', 'ps-scripts.html'],
    'shell': ['shell-intro.html', 'shell-scripts.html', 'shell-commands.html'],
    'assembly': ['asm-intro.html', 'asm-registers.html', 'asm-instructions.html'],
    'yaml': ['yaml-intro.html', 'yaml-syntax.html'],
    'markdown': ['markdown-intro.html', 'markdown-syntax.html'],
    'bootstrap': ['bootstrap-intro.html', 'bootstrap-grid.html', 'bootstrap-components.html'],
    'tailwind': ['tailwind-intro.html', 'tailwind-classes.html', 'tailwind-utility-first.html'],
    'tonejs': ['tone-intro.html', 'tone-synths.html', 'tone-effects.html'],
    'threejs': ['three-intro.html', 'three-scenes.html', 'three-objects.html'],
    'javascript': ['dom.html', 'conditions.html'], // Re-added for robustness
    'css': ['intro-to-css.html', 'selectors.html', 'box-model.html', 'flexbox.html', 'css-positioning.html'],
  };

  const selectRandomLesson = () => {
    const languagesKeys = Object.keys(programmingLanguages);
    const randomLang = languagesKeys[Math.floor(Math.random() * languagesKeys.length)];
    const lessons = programmingLanguages[randomLang];
    const randomLesson = lessons[Math.floor(Math.random() * lessons.length)];
    const lessonUrl = `https://houselearning.github.io/home/computerscience/${randomLang}/${randomLesson}`;

    lessonIframe.src = lessonUrl;
    lessonLink.href = lessonUrl;
  };

  selectRandomLesson();
  // --------------------------------------------------------

  // --- Code Snippet of the Day Logic ---
  const codeSnippetElement = document.getElementById('code-snippet');
  const snippetDescriptionElement = document.getElementById('snippet-description');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const runBtn = document.getElementById('run-btn');
  const outputContainer = document.getElementById('output-container');
  const outputCanvas = document.getElementById('output-canvas');
  const outputText = document.getElementById('output-text');

  const snippetsData = {
    python: {
      name: 'Python',
      snippets: [
        {
          description: 'A generator that yields Fibonacci numbers up to a given limit.',
          code: `def fibonacci_generator(n):
    a, b = 0, 1
    while a < n:
        yield a
        a, b = b, a + b

print(list(fibonacci_generator(100)))`,
          simulatedOutput: `[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]`
        },
        {
          description: 'Sorts a list of dictionaries by a specific key using a lambda function.',
          code: `data = [{'name': 'Alice', 'age': 30}, {'name': 'Bob', 'age': 25}, {'name': 'Charlie', 'age': 35}]
sorted_data = sorted(data, key=lambda x: x['age'])
print(sorted_data)`,
          simulatedOutput: `[{'name': 'Bob', 'age': 25}, {'name': 'Alice', 'age': 30}, {'name': 'Charlie', 'age': 35}]`
        },
        {
          description: 'Creates a simple multithreaded function to download URLs concurrently.',
          code: `import concurrent.futures
import urllib.request

URLS = ['http://www.python.org', 'http://www.google.com', 'http://www.bing.com']

def load_url(url, timeout):
    with urllib.request.urlopen(url, timeout=timeout) as conn:
        return conn.read()

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    future_to_url = {executor.submit(load_url, url, 60): url for url in URLS}
    for future in concurrent.futures.as_completed(future_to_url):
        url = future_to_url[future]
        try:
            data = future.result()
            print(f'Downloaded {len(data)} bytes from {url}')
        except Exception as exc:
            print(f'{url} generated an exception: {exc}')`,
          simulatedOutput: `Downloaded 49673 bytes from http://www.python.org
Downloaded 16422 bytes from http://www.google.com
Downloaded 31215 bytes from http://www.bing.com`
        },
        {
          description: 'A function that uses a decorator to time its execution.',
          code: `import time

def timer(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        print(f"Function {func.__name__} took {end_time - start_time:.4f} seconds to run.")
        return result
    return wrapper

@timer
def my_slow_function(delay):
    time.sleep(delay)

my_slow_function(2)`,
          simulatedOutput: `Function my_slow_function took 2.0001 seconds to run.`
        }
      ],
      runnable: false
    },
    javascript: {
      name: 'JavaScript',
      snippets: [
        {
          description: 'An advanced `fetch` example with async/await to get data from a public API.',
          code: `async function fetchPosts() {
    try {
        const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        const data = await response.json();
        console.log('Fetched Posts:');
        data.forEach(post => {
            console.log(\`Title: \${post.title}\`);
        });
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}
fetchPosts();`
        },
        {
          description: 'Creates a simple, interactive canvas drawing application.',
          code: `const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;
canvas.style.border = '1px solid #ccc';
outputCanvas.appendChild(canvas);
const ctx = canvas.getContext('2d');
let isDrawing = false;

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseout', () => {
    isDrawing = false;
});`
        },
        {
          description: 'Demonstrates a simple event delegation for a list.',
          code: `const list = document.createElement('ul');
list.innerHTML = '<li>Item 1</li><li>Item 2</li><li>Item 3</li>';
outputCanvas.appendChild(list);

list.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
        console.log('Clicked on:', e.target.textContent);
    }
});`
        },
        {
          description: 'Uses `Promise.all` to fetch data from multiple endpoints concurrently.',
          code: `const fetchUsers = fetch('https://jsonplaceholder.typicode.com/users?_limit=2').then(res => res.json());
const fetchTodos = fetch('https://jsonplaceholder.typicode.com/todos?_limit=3').then(res => res.json());

Promise.all([fetchUsers, fetchTodos])
    .then(([users, todos]) => {
        console.log('Fetched all data!');
        console.log('Users:', users.map(u => u.name));
        console.log('Todos:', todos.map(t => t.title));
    })
    .catch(error => console.error('Error fetching data:', error));`
        }
      ],
      runnable: true
    },
    java: {
      name: 'Java',
      snippets: [
        {
          description: 'Uses a HashMap to count the frequency of each word in a string.',
          code: `import java.util.HashMap;
import java.util.Map;

public class WordCounter {
    public static void main(String[] args) {
        String text = "hello world hello java world";
        String[] words = text.split(" ");
        Map<String, Integer> wordCount = new HashMap<>();

        for (String word : words) {
            wordCount.put(word, wordCount.getOrDefault(word, 0) + 1);
        }

        System.out.println(wordCount);
    }
}`,
          simulatedOutput: `{hello=2, world=2, java=1}`
        },
        {
          description: 'Implements a simple merge sort algorithm for an array of integers.',
          code: `public class MergeSort {
    public static void merge(int[] left, int[] right, int[] arr) {
        int i = 0, j = 0, k = 0;
        while (i < left.length && j < right.length) {
            if (left[i] <= right[j]) {
                arr[k++] = left[i++];
            } else {
                arr[k++] = right[j++];
            }
        }
        while (i < left.length) {
            arr[k++] = left[i++];
        }
        while (j < right.length) {
            arr[k++] = right[j++];
        }
    }

    public static void mergeSort(int[] arr) {
        if (arr.length < 2) {
            return;
        }
        int mid = arr.length / 2;
        int[] left = new int[mid];
        int[] right = new int[arr.length - mid];

        for (int i = 0; i < mid; i++) {
            left[i] = arr[i];
        }
        for (int i = mid; i < arr.length; i++) {
            right[i - mid] = arr[i];
        }
        mergeSort(left);
        mergeSort(right);
        merge(left, right, arr);
    }

    public static void main(String[] args) {
        int[] numbers = {4, 1, 3, 9, 7};
        mergeSort(numbers);
        for (int num : numbers) {
            System.out.print(num + " ");
        }
    }
}`,
          simulatedOutput: `1 3 4 7 9 `
        }
      ],
      runnable: false
    },
    ruby: {
      name: 'Ruby',
      snippets: [
        {
          description: 'Defines a class to represent a book with author and title attributes.',
          code: `class Book
  attr_accessor :title, :author

  def initialize(title, author)
    @title = title
    @author = author
  end

  def to_s
    "\\"#{@title}\\" by #{@author}"
  end
end

book1 = Book.new("The Hobbit", "J.R.R. Tolkien")
puts book1`,
          simulatedOutput: `"The Hobbit" by J.R.R. Tolkien`
        },
        {
          description: 'A method to check if a string is a palindrome, ignoring case.',
          code: `def is_palindrome?(string)
  processed_string = string.downcase.gsub(/[^a-z0-9]/, '')
  processed_string == processed_string.reverse
end

puts is_palindrome?("A man, a plan, a canal: Panama") # true
puts is_palindrome?("hello world") # false`,
          simulatedOutput: `true
false`
        }
      ],
      runnable: false
    },
    'c++': {
      name: 'C++',
      snippets: [
        {
          description: 'Implements a vector to store and manipulate a list of integers.',
          code: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> my_vector = {1, 2, 3, 4, 5};
    my_vector.push_back(6);

    std::cout << "Vector elements: ";
    for (int i : my_vector) {
        std::cout << i << " ";
    }
    std::cout << std::endl;

    int sum = std::accumulate(my_vector.begin(), my_vector.end(), 0);
    std::cout << "Sum of elements: " << sum << std::endl;
    return 0;
}`,
          simulatedOutput: `Vector elements: 1 2 3 4 5 6 
Sum of elements: 21`
        },
        {
          description: 'A program that uses a function to calculate the area of a circle.',
          code: `#include <iostream>
#include <cmath>

const double PI = 3.14159;

double circle_area(double radius) {
    return PI * pow(radius, 2);
}

int main() {
    double radius = 5.0;
    std::cout << "The area of a circle with radius " << radius << " is " << circle_area(radius) << std::endl;
    return 0;
}`,
          simulatedOutput: `The area of a circle with radius 5 is 78.5397`
        }
      ],
      runnable: false
    },
    go: {
      name: 'Go',
      snippets: [
        {
          description: 'Demonstrates concurrency with goroutines and channels to calculate the sum of numbers.',
          code: `package main
import "fmt"

func sum(s []int, c chan int) {
	sum := 0
	for _, v := range s {
		sum += v
	}
	c <- sum
}

func main() {
	s := []int{7, 2, 8, -9, 4, 0}
	c := make(chan int)
	
	go sum(s[:len(s)/2], c)
	go sum(s[len(s)/2:], c)
	
	x, y := <-c, <-c
	
	fmt.Println(x, y, x+y)
}`,
          simulatedOutput: `17 -5 12`
        },
        {
          description: 'Defines a struct and a method to represent a person.',
          code: `package main
import "fmt"

type Person struct {
    Name string
    Age  int
}

func (p Person) Greet() string {
    return fmt.Sprintf("Hello, my name is %s and I am %d years old.", p.Name, p.Age)
}

func main() {
    person := Person{Name: "Alice", Age: 30}
    fmt.Println(person.Greet())
}`,
          simulatedOutput: `Hello, my name is Alice and I am 30 years old.`
        }
      ],
      runnable: false
    },
    swift: {
      name: 'Swift',
      snippets: [
        {
          description: 'A function that uses a `guard` statement to validate a user ID.',
          code: `import Foundation

func fetchUserData(id: String?) {
    guard let userId = id else {
        print("Error: User ID is nil.")
        return
    }
    print("Fetching data for user \(userId)...")
}

fetchUserData(id: "12345")
fetchUserData(id: nil)`,
          simulatedOutput: `Fetching data for user 12345...
Error: User ID is nil.`
        },
        {
          description: 'Defines a struct for a coordinate and computes the distance to another point.',
          code: `import Foundation

struct Coordinate {
    var x: Double
    var y: Double
    
    func distance(to other: Coordinate) -> Double {
        let deltaX = other.x - x
        let deltaY = other.y - y
        return sqrt(deltaX * deltaX + deltaY * deltaY)
    }
}

let p1 = Coordinate(x: 0, y: 0)
let p2 = Coordinate(x: 3, y: 4)

print("Distance between p1 and p2 is \(p1.distance(to: p2))")`,
          simulatedOutput: `Distance between p1 and p2 is 5.0`
        }
      ],
      runnable: false
    },
    kotlin: {
      name: 'Kotlin',
      snippets: [
        {
          description: 'A data class for a `User` with a custom `toString` method.',
          code: `data class User(val name: String, val age: Int) {
    override fun toString(): String {
        return "User(name='$name', age=$age)"
    }
}

fun main() {
    val user1 = User("Alice", 30)
    val user2 = user1.copy(age = 31)
    
    println(user1)
    println(user2)`,
          simulatedOutput: `User(name='Alice', age=30)
User(name='Alice', age=31)`
        },
        {
          description: 'Uses a `when` expression for a more readable conditional check.',
          code: `fun describe(obj: Any): String =
    when (obj) {
        1          -> "One"
        "Hello"    -> "Greeting"
        is Long    -> "Long number"
        !is String -> "Not a string"
        else       -> "Unknown"
    }
    
fun main() {
    println(describe(1))
    println(describe("Hello"))
    println(describe(1000L))
    println(describe(true))
}`,
          simulatedOutput: `One
Greeting
Long number
Not a string`
        }
      ],
      runnable: false
    },
    php: {
      name: 'PHP',
      snippets: [
        {
          description: 'Defines a class for a simple calculator with methods for addition, subtraction, multiplication, and division.',
          code: `<?php

class Calculator {
    public function add($a, $b) {
        return $a + $b;
    }
    public function subtract($a, $b) {
        return $a - $b;
    }
}

$calc = new Calculator();
echo "5 + 3 = " . $calc->add(5, 3) . "\\n";
echo "10 - 4 = " . $calc->subtract(10, 4) . "\\n";

?>`,
          simulatedOutput: `5 + 3 = 8
10 - 4 = 6`
        },
        {
          description: 'A function that uses `array_filter` to find all even numbers in an array.',
          code: `<?php

$numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
$evenNumbers = array_filter($numbers, function($n) {
    return ($n % 2 == 0);
});

print_r($evenNumbers);

?>`,
          simulatedOutput: `Array
(
    [1] => 2
    [3] => 4
    [5] => 6
    [7] => 8
    [9] => 10
)`
        }
      ],
      runnable: false
    },
    typescript: {
      name: 'TypeScript',
      snippets: [
        {
          description: 'Defines an interface and a class that implements it.',
          code: `interface User {
    id: number;
    name: string;
}

class UserService {
    private users: User[] = [];

    addUser(user: User): void {
        this.users.push(user);
    }

    getUsers(): User[] {
        return this.users;
    }
}

const service = new UserService();
service.addUser({ id: 1, name: "Alice" });
service.addUser({ id: 2, name: "Bob" });
console.log(service.getUsers());`
        },
        {
          description: 'Demonstrates a generic function that can work with different types.',
          code: `function reverseArray<T>(items: T[]): T[] {
    return items.reverse();
}

let numbers = [1, 2, 3, 4, 5];
let reversedNumbers = reverseArray(numbers);
console.log(reversedNumbers);

let strings = ["a", "b", "c"];
let reversedStrings = reverseArray(strings);
console.log(reversedStrings);`
        }
      ],
      runnable: true
    },
    r: {
      name: 'R',
      snippets: [
        {
          description: 'Creates a simple data frame and calculates the mean age.',
          code: `data <- data.frame(
  name = c("Alice", "Bob", "Charlie"),
  age = c(25, 30, 35)
)

print(data)
print(paste("Mean age is:", mean(data$age)))`,
          simulatedOutput: `      name age
1    Alice  25
2      Bob  30
3  Charlie  35
[1] "Mean age is: 30"`
        },
        {
          description: 'Generates a simple plot of a sine wave.',
          code: `x <- seq(0, 2*pi, length.out = 100)
y <- sin(x)
plot(x, y, type = "l", main = "Sine Wave", col = "blue")`,
          simulatedOutput: `A simple plot would be generated in an R environment.`
        }
      ],
      runnable: false
    },
    sql: {
      name: 'SQL',
      snippets: [
        {
          description: 'A query that joins two tables and filters by a condition.',
          code: `SELECT 
    c.CustomerID,
    c.CustomerName,
    o.OrderID
FROM 
    Customers c
INNER JOIN 
    Orders o ON c.CustomerID = o.CustomerID
WHERE 
    o.OrderDate >= '2025-01-01';`,
          simulatedOutput: `| CustomerID | CustomerName | OrderID |
|------------|--------------|---------|
| 1          | Alfreds Futterkiste | 10248 |
| 3          | Antonio Moreno Taquería | 10250 |
| 5          | Berglunds snabbköp | 10252 |`
        },
        {
          description: 'A query to calculate the total sales for each category.',
          code: `SELECT 
    p.Category,
    SUM(od.Quantity * od.UnitPrice) as TotalSales
FROM 
    Products p
INNER JOIN 
    OrderDetails od ON p.ProductID = od.ProductID
GROUP BY 
    p.Category
ORDER BY 
    TotalSales DESC;`,
          simulatedOutput: `| Category | TotalSales |
|----------|------------|
| Beverages | 12500.00 |
| Dairy Products | 9850.50 |
| Confections | 7621.25 |`
        }
      ],
      runnable: false
    },
    dart: {
      name: 'Dart',
      snippets: [
        {
          description: 'A function that uses a `Future` to simulate an asynchronous operation.',
          code: `import 'dart:async';

Future<String> fetchUserData() {
  return Future.delayed(Duration(seconds: 2), () => 'User data fetched!');
}

void main() async {
  print('Fetching user data...');
  String data = await fetchUserData();
  print(data);`,
          simulatedOutput: `Fetching user data...
User data fetched!`
        },
        {
          description: 'Defines a class and uses a factory constructor.',
          code: `class Point {
  final double x, y;

  Point(this.x, this.y);

  factory Point.fromMap(Map<String, double> map) {
    return Point(map['x']!, map['y']!);
  }

  @override
  String toString() => 'Point(x: $x, y: $y)';
}

void main() {
  var p = Point.fromMap({'x': 10.0, 'y': 20.0});
  print(p);`,
          simulatedOutput: `Point(x: 10.0, y: 20.0)`
        }
      ],
      runnable: false
    },
    matlab: {
      name: 'MATLAB',
      snippets: [
        {
          description: 'Creates a simple 3D surface plot using meshgrid.',
          code: `[x,y] = meshgrid(-2:.2:2);
z = x .* exp(-x.^2 - y.^2);
figure;
mesh(x,y,z);
xlabel('x');
ylabel('y');
zlabel('z');
title('3D Surface Plot');`,
          simulatedOutput: `A 3D surface plot would be generated in a MATLAB environment.`
        },
        {
          description: 'Solves a system of linear equations using the backslash operator.',
          code: `A = [1 2 3; 4 5 6; 7 8 9];
B = [1; 2; 3];
x = A \\ B;
disp('Solution x:');
disp(x);`,
          simulatedOutput: `Solution x:
  -0.5000
   1.0000
  -0.5000`
        }
      ],
      runnable: false
    },
    bash: {
      name: 'Bash',
      snippets: [
        {
          description: 'A script that backs up a directory and compresses it with a timestamp.',
          code: `#!/bin/bash
SOURCE_DIR="/path/to/my/files"
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVE_NAME="backup-$TIMESTAMP.tar.gz"

if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
fi

tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$SOURCE_DIR" .
echo "Backup created at $BACKUP_DIR/$ARCHIVE_NAME"`,
          simulatedOutput: `Backup created at /path/to/backups/backup-2025-08-09_07-30-00.tar.gz`
        },
        {
          description: 'A simple `if/else` conditional to check if a file exists.',
          code: `#!/bin/bash
FILE="/etc/hosts"
if [ -f "$FILE" ]; then
    echo "File '$FILE' exists."
else
    echo "File '$FILE' does not exist."
fi`,
          simulatedOutput: `File '/etc/hosts' exists.`
        }
      ],
      runnable: false
    },
    perl: {
      name: 'Perl',
      snippets: [
        {
          description: 'A script that uses a regular expression to find all email addresses in a file.',
          code: `#!/usr/bin/perl
use strict;
use warnings;

my $filename = 'data.txt';
open my $fh, '<', $filename or die "Cannot open file: $!";

while (my $line = <$fh>) {
    if ($line =~ /\\b[A-Za-z0-9._%+-]+\\@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}\\b/) {
        print "Found email: $&\n";
    }
}
close $fh;`,
          simulatedOutput: `Found email: example@email.com`
        }
      ],
      runnable: false
    },
    json: {
      name: 'JSON',
      snippets: [
        {
          description: 'An example of a nested JSON object representing user data.',
          code: `{
    "user": {
        "id": 123,
        "username": "coder_42",
        "email": "coder@example.com",
        "is_active": true,
        "roles": ["admin", "editor"],
        "profile": {
            "full_name": "Jane Doe",
            "bio": "Software developer with a passion for open source.",
            "social_media": {
                "twitter": "janedev",
                "github": "janedoe"
            }
        }
    },
    "projects": [
        {"id": 1, "name": "Project Alpha"},
        {"id": 2, "name": "Project Beta"}
    ]
}`,
          simulatedOutput: `No output to display. JSON is a data format, not an executable script.`
        }
      ],
      runnable: false
    },
    powershell: {
      name: 'PowerShell',
      snippets: [
        {
          description: 'A script that lists all running processes and exports them to a CSV file.',
          code: `Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 10 | Export-Csv -Path "C:\\temp\\top_processes.csv" -NoTypeInformation`,
          simulatedOutput: `A CSV file "top_processes.csv" would be created in the "C:\\temp" directory.`
        }
      ],
      runnable: false
    },
    shell: {
      name: 'Shell Scripting',
      snippets: [
        {
          description: 'A script that checks for a specific process and restarts it if it\'s not running.',
          code: `#!/bin/bash

PROCESS_NAME="my_app"
LOG_FILE="/var/log/my_app_monitor.log"

if pgrep "$PROCESS_NAME" > /dev/null; then
    echo "$(date): $PROCESS_NAME is running." >> "$LOG_FILE"
else
    echo "$(date): $PROCESS_NAME is not running. Restarting..." >> "$LOG_FILE"
    # Start the process here
    # e.g., /usr/bin/my_app &
fi`,
          simulatedOutput: `The script would write a log message to /var/log/my_app_monitor.log.`
        }
      ],
      runnable: false
    },
    assembly: {
      name: 'Assembly',
      snippets: [
        {
          description: 'A simple x86-64 assembly program that adds two numbers and exits.',
          code: `section .data
    msg db "The sum is: ", 0xa
    len equ $ - msg

section .text
    global _start

_start:
    ; Add two numbers
    mov rax, 10
    mov rbx, 20
    add rax, rbx

    ; Print message
    mov rsi, msg
    mov rdx, len
    mov rax, 1
    mov rdi, 1
    syscall

    ; Print the sum (requires more complex logic for number to string conversion)
    ; This is a placeholder for a more complex operation.

    ; Exit
    mov rax, 60
    xor rdi, rdi
    syscall`,
          simulatedOutput: `The sum is: 30`
        }
      ],
      runnable: false
    },
    yaml: {
      name: 'YAML',
      snippets: [
        {
          description: 'A YAML file for a complex CI/CD pipeline configuration.',
          code: `version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:18.10.0
    steps:
      - checkout
      - run:
          name: Install Dependencies
          command: npm install
      - run:
          name: Run Tests
          command: npm test
  deploy:
    docker:
      - image: cimg/node:18.10.0
    steps:
      - run:
          name: Deploy to Production
          command: echo "Deployment script here..."

workflows:
  build-and-deploy:
    jobs:
      - build
      - deploy:
          requires:
            - build
          filters:
            branches:
              only: main`,
          simulatedOutput: `No output to display. YAML is a data format used for configuration, not an executable script.`
        }
      ],
      runnable: false
    },
    markdown: {
      name: 'Markdown',
      snippets: [
        {
          description: 'A Markdown example demonstrating various formatting features.',
          code: `# This is a Markdown Heading
This is a paragraph with **bold** text and *italic* text.

## A Subheading

- List item one
- List item two
  - Nested list item
- List item three

Here's a code block:
\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

> This is a blockquote.

[Link to Google](https://www.google.com)`,
          simulatedOutput: `No output to display. Markdown is a markup language for formatting text.`
        }
      ],
      runnable: false
    },
    bootstrap: {
      name: 'Bootstrap',
      snippets: [
        {
          description: 'A Bootstrap card component with an image, title, and button.',
          code: `<div class="card" style="width: 18rem;">
  <img src="..." class="card-img-top" alt="...">
  <div class="card-body">
    <h5 class="card-title">Card title</h5>
    <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
    <a href="#" class="btn btn-primary">Go somewhere</a>
  </div>
</div>`,
          simulatedOutput: `No output to display. This is an HTML snippet for styling with Bootstrap.`
        }
      ],
      runnable: false
    },
    tailwind: {
      name: 'Tailwind CSS',
      snippets: [
        {
          description: 'A card component styled with Tailwind CSS utility classes.',
          code: `<div class="max-w-sm rounded overflow-hidden shadow-lg p-6 bg-white dark:bg-gray-800">
  <img class="w-full h-48 object-cover" src="..." alt="Sunset in the mountains">
  <div class="px-6 py-4">
    <div class="font-bold text-xl mb-2 text-gray-900 dark:text-gray-100">The Coldest Sunset</div>
    <p class="text-gray-700 dark:text-gray-300 text-base">
      Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptatibus quia, nulla! Maiores et perferendis eaque, exercitationem praesentium nihil.
    </p>
  </div>
  <div class="px-6 pt-4 pb-2">
    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">#photography</span>
    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">#travel</span>
    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">#winter</span>
  </div>
</div>`,
          simulatedOutput: `No output to display. This is an HTML snippet for styling with Tailwind CSS.`
        }
      ],
      runnable: false
    },
    'three.js': {
      name: 'THREE.js',
      snippets: [
        {
          description: 'Creates a basic THREE.js scene with a rotating cube.',
          code: `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 400 / 300, 0.1, 1000); // Use fixed aspect ratio for demo
const renderer = new THREE.WebGLRenderer();
renderer.setSize(400, 300);
outputCanvas.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();`
        }
      ],
      runnable: true
    },
    'tone.js': {
      name: 'Tone.js',
      snippets: [
        {
          description: 'Plays a simple synth note when the user interacts with the page.',
          code: `const synth = new Tone.Synth().toDestination();

function playNote() {
    synth.triggerAttackRelease("C4", "8n");
}

const playButton = document.createElement('button');
playButton.textContent = 'Play C4';
playButton.style.cssText = \`
    padding: 10px 20px;
    font-size: 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    background-color: #61dafb;
    color: #20232a;
    transition: background-color 0.2s ease, transform 0.1s ease;
\`;
playButton.addEventListener('click', () => {
    // Need to start audio context on user interaction
    Tone.start(); 
    playNote();
});
outputCanvas.appendChild(playButton);`
        }
      ],
      runnable: true
    },
    css: {
      name: 'CSS',
      snippets: [
        {
          description: 'CSS for a modern button with hover and active states.',
          code: `/* CSS for a modern button */
.btn-modern {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid #61dafb;
  border-radius: 50px;
  font-weight: 600;
  text-decoration: none;
  color: #61dafb;
  background-color: transparent;
  transition: all 0.3s ease;
}

.btn-modern:hover {
  color: #20232a;
  background-color: #61dafb;
  transform: translateY(-3px);
  box-shadow: 0 4px 10px rgba(97, 218, 251, 0.5);
}

.btn-modern:active {
  transform: translateY(0);
  box-shadow: none;
}`,
          simulatedOutput: `No output to display. This is a CSS snippet for styling.`
        }
      ],
      runnable: false
    }
  };

  const allNavbarLinks = document.querySelectorAll('.navbar a');
  const supportedLanguages = new Set(Object.keys(snippetsData));
  const availableNavbarLanguages = [];

  allNavbarLinks.forEach(link => {
    const langName = link.textContent.trim().toLowerCase();
    if (langName === 'javascript') {
      availableNavbarLanguages.push('javascript');
    } else if (langName === 'three.js') {
      availableNavbarLanguages.push('three.js');
    } else if (langName === 'tone.js') {
      availableNavbarLanguages.push('tone.js');
    } else if (supportedLanguages.has(langName)) {
      availableNavbarLanguages.push(langName);
    }
  });

  const selectRandomSnippet = () => {
    const randomLangKey = availableNavbarLanguages[Math.floor(Math.random() * availableNavbarLanguages.length)];
    const lang = snippetsData[randomLangKey];
    const randomSnippet = lang.snippets[Math.floor(Math.random() * lang.snippets.length)];

    snippetDescriptionElement.textContent = `A random snippet in ${lang.name}: ${randomSnippet.description}`;
    codeSnippetElement.textContent = randomSnippet.code;
    codeSnippetElement.className = `language-${randomLangKey}`;

    runBtn.disabled = false;
    runBtn.textContent = 'Run';

    outputContainer.style.display = 'none';
    outputCanvas.innerHTML = '';
    outputText.textContent = '';
  };

  copyBtn.addEventListener('click', () => {
    const textToCopy = codeSnippetElement.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
  });

  downloadBtn.addEventListener('click', () => {
    const snippetCode = codeSnippetElement.textContent;
    const lang = codeSnippetElement.className.split('-')[1];
    let fileExtension;
    switch (lang) {
      case 'python':
        fileExtension = 'py';
        break;
      case 'javascript':
        fileExtension = 'js';
        break;
      case 'java':
        fileExtension = 'java';
        break;
      case 'ruby':
        fileExtension = 'rb';
        break;
      case 'c++':
        fileExtension = 'cpp';
        break;
      case 'go':
        fileExtension = 'go';
        break;
      case 'swift':
        fileExtension = 'swift';
        break;
      case 'kotlin':
        fileExtension = 'kt';
        break;
      case 'php':
        fileExtension = 'php';
        break;
      case 'typescript':
        fileExtension = 'ts';
        break;
      case 'r':
        fileExtension = 'r';
        break;
      case 'sql':
        fileExtension = 'sql';
        break;
      case 'dart':
        fileExtension = 'dart';
        break;
      case 'matlab':
        fileExtension = 'm';
        break;
      case 'bash':
        fileExtension = 'sh';
        break;
      case 'perl':
        fileExtension = 'pl';
        break;
      case 'json':
        fileExtension = 'json';
        break;
      case 'powershell':
        fileExtension = 'ps1';
        break;
      case 'shell':
        fileExtension = 'sh';
        break;
      case 'assembly':
        fileExtension = 'asm';
        break;
      case 'yaml':
        fileExtension = 'yml';
        break;
      case 'markdown':
        fileExtension = 'md';
        break;
      case 'bootstrap':
      case 'tailwind':
      case 'css':
        fileExtension = 'css';
        break;
      case 'three.js':
      case 'tone.js':
        fileExtension = 'js';
        break;
      default:
        fileExtension = 'txt';
    }

    const blob = new Blob([snippetCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippet-of-the-day.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  runBtn.addEventListener('click', () => {
    outputContainer.style.display = 'block';
    outputCanvas.innerHTML = '';
    outputText.textContent = '';

    const langKey = codeSnippetElement.className.split('-')[1];
    const currentLangData = snippetsData[langKey];
    const currentSnippet = currentLangData.snippets.find(s => s.code === codeSnippetElement.textContent);

    let hasCanvasOutput = false;
    let consoleOutput = ''; // Reset console output on each run

    // Function to perform basic Markdown to HTML conversion
    const markdownToHtml = (markdown) => {
        let html = markdown
            .replace(/^#\s(.*$)/gim, '<h1>$1</h1>')
            .replace(/^##\s(.*$)/gim, '<h2>$1</h2>')
            .replace(/^###\s(.*$)/gim, '<h3>$1</h3>')
            .replace(/^\s*\*\s(.*$)/gim, '<li>$1</li>') // Handle unordered lists
            .replace(/^>\s(.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
            .replace(/```(.*?)```/gims, '<pre><code>$1</code></pre>') // Code blocks
            .replace(/\`(.*?)\`/gims, '<code>$1</code>') // Inline code
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap paragraphs in <p> tags
        html = '<p>' + html + '</p>';
        return html;
    };

    // Logic for HTML, CSS, Markdown, and other previews
    const snippetCode = codeSnippetElement.textContent;
    const isHTML = ['bootstrap', 'tailwind'].includes(langKey);
    const isCSS = langKey === 'css';
    const isMarkdown = langKey === 'markdown';
    const isFileDownload = (langKey === 'powershell' && currentSnippet.description.includes('exports them to a CSV file')) || (langKey === 'bash' && currentSnippet.description.includes('backs up a directory'));
    const isPlot = ['r', 'matlab'].includes(langKey) && currentSnippet.description.includes('plot');
    const isUrlDownload = langKey === 'python' && currentSnippet.description.includes('download URLs concurrently');

    if (isHTML) {
      outputCanvas.innerHTML = `<style>
        .container {
          padding: 1rem;
        }
        .card {
          border: 1px solid #ccc;
          border-radius: 0.25rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        /* Basic Bootstrap/Tailwind card styling for a clean preview */
        .card-body, .px-6, .py-4 { padding: 1rem; }
        .card-title, .font-bold { font-weight: bold; }
      </style>
      <div class="container">${snippetCode}</div>`;
      outputText.textContent = 'Previewing HTML/CSS output in the canvas.';
      hasCanvasOutput = true;
    } else if (isCSS) {
      const styleTag = document.createElement('style');
      styleTag.textContent = snippetCode;
      outputCanvas.appendChild(styleTag);
      outputCanvas.innerHTML += `<button class="btn-modern">Styled Button</button>`;
      outputText.textContent = 'CSS preview applied to a sample element in the canvas.';
      hasCanvasOutput = true;
    } else if (isMarkdown) {
      const htmlOutput = markdownToHtml(snippetCode);
      outputCanvas.innerHTML = `<div class="markdown-preview">${htmlOutput}</div>`;
      outputText.textContent = 'Markdown translated to HTML and previewed in the canvas.';
      hasCanvasOutput = true;
    } else if (isPlot) {
        outputCanvas.innerHTML = `
            <style>
                .plot-canvas-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    height: 100%;
                    background-color: #fff;
                    border: 1px solid #ccc;
                }
            </style>
            <div class="plot-canvas-wrapper">
                <canvas id="plot-canvas" width="400" height="300"></canvas>
            </div>
        `;
        outputText.textContent = `Generating a simulated ${langKey} plot on the canvas.`;

        const plotCanvas = document.getElementById('plot-canvas');
        const ctx = plotCanvas.getContext('2d');
        
        ctx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
        
        // Draw axes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, 270);
        ctx.lineTo(380, 270);
        ctx.lineTo(380, 30);
        ctx.stroke();

        // Draw sine wave
        if (langKey === 'r') {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 400; i++) {
                const x = i;
                const y = 100 * Math.sin((i / 400) * 2 * Math.PI) + 150;
                if (i === 0) {
                    ctx.moveTo(x + 30, y);
                } else {
                    ctx.lineTo(x + 30, y);
                }
            }
            ctx.stroke();
        } else if (langKey === 'matlab') {
            // Draw a simulated 3D plot
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.moveTo(50, 150);
            ctx.lineTo(150, 50);
            ctx.lineTo(350, 150);
            ctx.lineTo(250, 250);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.stroke();
            
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.fillText('Simulated 3D Plot', 150, 20);
        }

        hasCanvasOutput = true;
    } else if (isUrlDownload) {
        const showFileViewerWithFiles = (files) => {
            const fileListHtml = files.map(file => `<li data-file="${file}">${file}</li>`).join('');
            outputCanvas.innerHTML = `
              <style>
                .file-viewer-container {
                  padding: 20px;
                  font-family: sans-serif;
                  color: #333;
                }
                .file-viewer-container h4 {
                  margin-bottom: 15px;
                }
                .file-list {
                  list-style-type: none;
                  padding: 0;
                }
                .file-list li {
                  padding: 8px 10px;
                  border-bottom: 1px solid #eee;
                  cursor: pointer;
                  transition: background-color 0.2s ease;
                }
                .file-list li:hover {
                  background-color: #f0f0f0;
                }
                .file-list li:last-child {
                  border-bottom: none;
                }
              </style>
              <div class="file-viewer-container">
                <h4>File Viewer</h4>
                <ul class="file-list">
                  ${fileListHtml}
                </ul>
              </div>
            `;
            outputText.textContent = 'Simulated file viewer. Click a file to open.';
        };
        const showLoadingDialog = (fileName) => {
            outputCanvas.innerHTML = `
              <style>
                .dialog-box {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  background: #fff;
                  border: 1px solid #ccc;
                  padding: 20px;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                  width: 300px;
                  text-align: center;
                  border-radius: 8px;
                }
                .progress-bar-container {
                  width: 100%;
                  background-color: #e0e0e0;
                  border-radius: 5px;
                  margin-top: 15px;
                }
                .progress-bar {
                  width: 0%;
                  height: 20px;
                  background-color: #4CAF50;
                  border-radius: 5px;
                  transition: width 0.4s ease;
                }
              </style>
              <div class="dialog-box">
                <h4>Opening ${fileName}...</h4>
                <div class="progress-bar-container">
                  <div id="progress-bar" class="progress-bar"></div>
                </div>
                <p>Loading...</p>
              </div>
            `;
            const progressBar = document.getElementById('progress-bar');
            let progress = 0;
            const interval = setInterval(() => {
                if (progress >= 70) {
                    clearInterval(interval);
                    showFileErrorDialog(fileName);
                    return;
                }
                progress += 10;
                progressBar.style.width = `${progress}%`;
            }, 300);
        };
        const showFileErrorDialog = (fileName) => {
            outputCanvas.innerHTML = `
              <style>
                .dialog-box {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  background: #fff;
                  border: 1px solid #ccc;
                  padding: 20px;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                  width: 300px;
                  text-align: center;
                  border-radius: 8px;
                }
                .dialog-box h4 {
                    color: #ff6347;
                }
                .dialog-box button {
                    padding: 8px 20px;
                    margin-top: 15px;
                    cursor: pointer;
                }
                .learn-more-link {
                    display: block;
                    margin-top: 10px;
                    font-size: 14px;
                }
              </style>
              <div class="dialog-box">
                <h4>File Error</h4>
                <p>There was an error opening the file: ${fileName}</p>
                <a href="#" class="learn-more-link" id="learn-more">Learn More</a>
                <button id="ok-btn">OK</button>
              </div>
            `;
            document.getElementById('ok-btn').addEventListener('click', () => {
              showFileViewerWithFiles(['Google.html', 'Bing.html', 'Python.html']);
            });
            document.getElementById('learn-more').addEventListener('click', (e) => {
              e.preventDefault();
              showBrowser();
            });
        };
        const showBrowser = () => {
            outputCanvas.innerHTML = `
              <style>
                .browser-container {
                  border: 1px solid #ccc;
                  height: 100%;
                  width: 100%;
                  display: flex;
                  flex-direction: column;
                  background-color: #f1f1f1;
                }
                .browser-header {
                  display: flex;
                  align-items: center;
                  padding: 5px 10px;
                  background-color: #ddd;
                  border-bottom: 1px solid #ccc;
                  font-family: sans-serif;
                }
                .browser-header span {
                  margin-right: auto;
                  font-weight: bold;
                }
                .browser-header .address-bar {
                  flex-grow: 1;
                  padding: 3px 8px;
                  background-color: #fff;
                  border: 1px solid #ccc;
                  border-radius: 5px;
                  margin: 0 10px;
                  font-size: 12px;
                }
                .browser-header button {
                  border: none;
                  background: #ff6347;
                  color: #fff;
                  padding: 3px 8px;
                  border-radius: 5px;
                  cursor: pointer;
                }
                .browser-body {
                  flex-grow: 1;
                  padding: 20px;
                  background-color: #fff;
                  overflow-y: auto;
                }
              </style>
              <div class="browser-container">
                <div class="browser-header">
                  <span>Browser</span>
                  <div class="address-bar">messages.cs.com/fil...</div>
                  <button id="close-browser-btn">Close</button>
                </div>
                <div class="browser-body">
                  <h4>File Error Dialog, what to do</h4>
                  <hr>
                  <p>This is just a simmulation, so this error is just here</p>
                </div>
              </div>
            `;
            document.getElementById('close-browser-btn').addEventListener('click', () => {
              showFileErrorDialog('Google.html');
            });
        };
        showFileViewerWithFiles(['Google.html', 'Bing.html', 'Python.html']);
        outputCanvas.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
              const fileName = e.target.dataset.file;
              showLoadingDialog(fileName);
            }
        });
        hasCanvasOutput = true;
    } else if (isFileDownload) {
      if (langKey === 'powershell') {
        outputCanvas.innerHTML = `
            <style>
                .csv-table-container {
                    padding: 20px;
                    font-family: monospace;
                    overflow-x: auto;
                }
                .csv-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1px solid #ccc;
                }
                .csv-table th, .csv-table td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: left;
                }
                .csv-table th {
                    background-color: #f2f2f2;
                }
            </style>
            <div class="csv-table-container">
                <h4>top_processes.csv</h4>
                <table class="csv-table">
                    <thead>
                        <tr>
                            <th>ProcessName</th>
                            <th>Id</th>
                            <th>CPU</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>System</td>
                            <td>4</td>
                            <td>12.5</td>
                        </tr>
                        <tr>
                            <td>svchost</td>
                            <td>820</td>
                            <td>8.1</td>
                        </tr>
                        <tr>
                            <td>powershell</td>
                            <td>1234</td>
                            <td>5.3</td>
                        </tr>
                        <tr>
                            <td>chrome</td>
                            <td>5678</td>
                            <td>4.9</td>
                        </tr>
                        <tr>
                            <td>firefox</td>
                            <td>9101</td>
                            <td>3.2</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        outputText.textContent = 'Simulated CSV file displayed on the canvas.';
        hasCanvasOutput = true;
      } else {
        const showFileViewer = () => {
          outputCanvas.innerHTML = `
            <style>
              .file-viewer-container {
                padding: 20px;
                font-family: sans-serif;
                color: #333;
              }
              .file-viewer-container h4 {
                margin-bottom: 15px;
              }
              .file-list {
                list-style-type: none;
                padding: 0;
              }
              .file-list li {
                padding: 8px 10px;
                border-bottom: 1px solid #eee;
                cursor: pointer;
                transition: background-color 0.2s ease;
              }
              .file-list li:hover {
                background-color: #f0f0f0;
              }
              .file-list li:last-child {
                border-bottom: none;
              }
            </style>
            <div class="file-viewer-container">
              <h4>File Viewer</h4>
              <ul class="file-list">
                <li data-file="top_processes.csv">top_processes.csv</li>
                <li data-file="backup-2025-08-09_07-30-00.tar.gz">backup-2025-08-09_07-30-00.tar.gz</li>
                <li data-file="another-file.txt">another-file.txt</li>
              </ul>
            </div>
          `;
          outputText.textContent = 'Simulated file viewer. Click a file to open.';
        };
  
        const showLoadingDialog = (fileName) => {
          outputCanvas.innerHTML = `
            <style>
              .dialog-box {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                border: 1px solid #ccc;
                padding: 20px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                width: 300px;
                text-align: center;
                border-radius: 8px;
              }
              .progress-bar-container {
                width: 100%;
                background-color: #e0e0e0;
                border-radius: 5px;
                margin-top: 15px;
              }
              .progress-bar {
                width: 0%;
                height: 20px;
                background-color: #4CAF50;
                border-radius: 5px;
                transition: width 0.4s ease;
              }
            </style>
            <div class="dialog-box">
              <h4>Opening ${fileName}...</h4>
              <div class="progress-bar-container">
                <div id="progress-bar" class="progress-bar"></div>
              </div>
              <p>Loading...</p>
            </div>
          `;
  
          const progressBar = document.getElementById('progress-bar');
          let progress = 0;
          const interval = setInterval(() => {
              if (progress >= 70) {
                  clearInterval(interval);
                  showFileErrorDialog(fileName);
                  return;
              }
              progress += 10;
              progressBar.style.width = `${progress}%`;
          }, 300);
        };
  
        const showFileErrorDialog = (fileName) => {
          outputCanvas.innerHTML = `
            <style>
              .dialog-box {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                border: 1px solid #ccc;
                padding: 20px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                width: 300px;
                text-align: center;
                border-radius: 8px;
              }
              .dialog-box h4 {
                  color: #ff6347;
              }
              .dialog-box button {
                  padding: 8px 20px;
                  margin-top: 15px;
                  cursor: pointer;
              }
              .learn-more-link {
                  display: block;
                  margin-top: 10px;
                  font-size: 14px;
              }
            </style>
            <div class="dialog-box">
              <h4>File Error</h4>
              <p>There was an error opening the file: ${fileName}</p>
              <a href="#" class="learn-more-link" id="learn-more">Learn More</a>
              <button id="ok-btn">OK</button>
            </div>
          `;
  
          document.getElementById('ok-btn').addEventListener('click', () => {
            showFileViewer();
          });
  
          document.getElementById('learn-more').addEventListener('click', (e) => {
            e.preventDefault();
            showBrowser();
          });
        };
  
        const showBrowser = () => {
          outputCanvas.innerHTML = `
            <style>
              .browser-container {
                border: 1px solid #ccc;
                height: 100%;
                width: 100%;
                display: flex;
                flex-direction: column;
                background-color: #f1f1f1;
              }
              .browser-header {
                display: flex;
                align-items: center;
                padding: 5px 10px;
                background-color: #ddd;
                border-bottom: 1px solid #ccc;
                font-family: sans-serif;
              }
              .browser-header span {
                margin-right: auto;
                font-weight: bold;
              }
              .browser-header .address-bar {
                flex-grow: 1;
                padding: 3px 8px;
                background-color: #fff;
                border: 1px solid #ccc;
                border-radius: 5px;
                margin: 0 10px;
                font-size: 12px;
              }
              .browser-header button {
                border: none;
                background: #ff6347;
                color: #fff;
                padding: 3px 8px;
                border-radius: 5px;
                cursor: pointer;
              }
              .browser-body {
                flex-grow: 1;
                padding: 20px;
                background-color: #fff;
                overflow-y: auto;
              }
            </style>
            <div class="browser-container">
              <div class="browser-header">
                <span>Browser</span>
                <div class="address-bar">messages.cs.com/fil...</div>
                <button id="close-browser-btn">Close</button>
              </div>
              <div class="browser-body">
                <h4>File Error Dialog, what to do</h4>
                <hr>
                <p>This is just a simmulation, so this error is just here</p>
              </div>
            </div>
          `;
  
          document.getElementById('close-browser-btn').addEventListener('click', () => {
            showFileErrorDialog('top_processes.csv'); // Return to the previous state
          });
        };
        showFileViewer();
        outputCanvas.addEventListener('click', (e) => {
          if (e.target.tagName === 'LI') {
            const fileName = e.target.dataset.file;
            showLoadingDialog(fileName);
          }
        });
        hasCanvasOutput = true;
      }
    } else if (langKey === 'sql' && currentSnippet && currentSnippet.simulatedOutput) {
        // SQL output handling
        const lines = currentSnippet.simulatedOutput.trim().split('\n');
        if (lines.length > 2) {
            const headerLine = lines[0];
            const dataLines = lines.slice(2);
            const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
            
            let tableHtml = `
                <style>
                    .csv-table-container {
                        padding: 20px;
                        font-family: monospace;
                        overflow-x: auto;
                    }
                    .csv-table {
                        width: 100%;
                        border-collapse: collapse;
                        border: 1px solid #ccc;
                    }
                    .csv-table th, .csv-table td {
                        border: 1px solid #ccc;
                        padding: 8px;
                        text-align: left;
                    }
                    .csv-table th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                </style>
                <div class="csv-table-container">
                    <h4>SQL Query Result</h4>
                    <table class="csv-table">
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${dataLines.map(line => {
                                const cells = line.split('|').map(c => c.trim()).filter(c => c);
                                return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            outputCanvas.innerHTML = tableHtml;
            outputText.textContent = 'Simulated SQL query results displayed on the canvas.';
            hasCanvasOutput = true;
        } else {
            // Handle cases with no data or a malformed table
            outputText.textContent = currentSnippet.simulatedOutput;
        }
    } else if (currentLangData.runnable) {
      // Use a temporary variable to capture console output
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        consoleOutput += args.join(' ') + '\n';
      };
      const originalConsoleError = console.error;
      console.error = (...args) => {
        consoleOutput += `<span class="console-error">Error: ${args.join(' ')}</span>\n`;
      };

      try {
        if (langKey === 'three.js') {
          if (typeof THREE === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = () => {
              const threeCode = new Function('THREE', 'document', 'outputCanvas', snippetCode);
              threeCode(window.THREE, document, outputCanvas);
            };
            document.head.appendChild(script);
          } else {
            const threeCode = new Function('THREE', 'document', 'outputCanvas', snippetCode);
            threeCode(window.THREE, document, outputCanvas);
          }
          hasCanvasOutput = true;
          outputText.textContent = 'Previewing 3D scene in the canvas.';
        } else if (langKey === 'tone.js') {
          if (typeof Tone === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.52/Tone.js';
            script.onload = () => {
              const toneCode = new Function('Tone', 'document', 'outputCanvas', snippetCode);
              toneCode(window.Tone, document, outputCanvas);
            };
            document.head.appendChild(script);
          } else {
            const toneCode = new Function('Tone', 'document', 'outputCanvas', snippetCode);
            toneCode(window.Tone, document, outputCanvas);
          }
          hasCanvasOutput = true;
          outputText.textContent = 'Interactive audio component preview in the canvas.';
        } else {
          const codeFunction = new Function('console', 'document', 'outputCanvas', currentSnippet.code);
          codeFunction(console, document, outputCanvas);
          // Check if the runnable code has appended anything to the canvas
          if (outputCanvas.innerHTML.trim() !== '') {
            hasCanvasOutput = true;
            outputText.textContent = 'Output displayed in the canvas.';
          }
        }
      } catch (e) {
        consoleOutput += `<span class="console-error">Execution Error: ${e.message}</span>\n`;
      } finally {
        // Restore console.log and console.error
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
      }
    }

    if (consoleOutput.trim() !== '') {
      outputCanvas.innerHTML = `
        <style>
          .console-container {
              font-family: monospace;
              white-space: pre-wrap;
              background-color: #2e2e2e;
              color: #d4d4d4;
              padding: 10px;
              border-radius: 5px;
              height: 100%;
              overflow-y: auto;
          }
          .console-header {
              font-weight: bold;
              color: #ffffff;
              border-bottom: 1px solid #555;
              padding-bottom: 5px;
              margin-bottom: 5px;
          }
          .console-error {
              color: #ff6347;
          }
        </style>
        <div class="console-container">
          <b class="console-header">Developer Console</b>
          <p>${consoleOutput}</p>
        </div>
      `;
      outputText.textContent = 'Output displayed in Developer Console.';
    } else if (!hasCanvasOutput && currentSnippet && currentSnippet.simulatedOutput) {
        // Fallback for non-runnable snippets with simulated output
        outputText.textContent = currentSnippet.simulatedOutput;
    } else if (!hasCanvasOutput && !isMarkdown) {
      // If there's no console output, no canvas output, and it's not a markdown file, show a generic message
      outputCanvas.innerHTML = '';
      outputText.textContent = 'No console output or errors.';
    }
  });

  selectRandomSnippet();
});
