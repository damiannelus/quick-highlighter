document.getElementById('btnHighlight').addEventListener('click', async () => {
  const text = document.getElementById('textInput').value;
  const lines = text.split('\n').filter(l => l.trim() !== "");
  const caseSensitive = document.getElementById('caseSensitive').checked;

  // Funkcja walidująca kolor
  const getSafeColor = (colorInput) => {
    const predefinedColors = ['red', 'green', 'yellow', 'blue', 'violet'];
    const hexRegex = /^#([A-Fa-f0-9]{3}){1,2}$/;

    if (predefinedColors.includes(colorInput.toLowerCase())) {
      return colorInput.toLowerCase();
    }
    if (hexRegex.test(colorInput)) {
      return colorInput;
    }
    return 'yellow'; // Fallback
  };
  
  // Mapujemy każdą linię na obiekt { phrase: string, color: string }
  const tasks = lines.map(line => {
    const match = line.match(/^\[(.*?)\](.*)/);
    if (match) {
      return { color: match[1], phrase: match[2].trim() };
    }
    return { color: 'yellow', phrase: line.trim() }; // Domyślny kolor
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["styles.css"]
  });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: highlightOnPage,
    args: [tasks, caseSensitive]
  });
});

// Ta funkcja zostanie "wstrzyknięta" i wykonana bezpośrednio na stronie
function highlightOnPage(tasks, caseSensitive) {
  const flags = caseSensitive ? 'g' : 'gi';
  
  tasks.forEach(task => {
    if (!task.phrase) return;

    const safePhrase = task.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\b${safePhrase}\\b)`, flags);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    const nodes = [];

    while (node = walker.nextNode()) {
        // Ignoruj tekst wewnątrz skryptów i stylów
        if (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
            nodes.push(node);
        }
    }

    nodes.forEach(textNode => {
      if (regex.test(textNode.textContent)) {
        const span = document.createElement('span');
        // Klasa z styles.css dla bazowych stylów + dynamiczny kolor tła
        span.innerHTML = textNode.textContent.replace(regex, 
          `<mark class="custom-highlight-mark" style="background-color: ${task.color} !important;">$1</mark>`
        );
        textNode.replaceWith(span);
      }
    });
  });
}