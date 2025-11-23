/**
 * TextTyper - Human-like typing simulation
 *
 * Features:
 * - Character-by-character typing
 * - Random delays between keystrokes (50-150ms)
 * - Random pauses (10% chance for 200-700ms pause)
 * - Handles both contenteditable and textarea elements
 * - Dispatches proper input/change events
 */

window.TextTyper = class TextTyper {
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async typeText(textArea, text) {
    textArea.focus();

    const isContentEditable = textArea.contentEditable === 'true' || textArea.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      textArea.focus();

      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      textArea.dispatchEvent(clickEvent);

      await this.sleep(300);

      textArea.innerHTML = '';
      textArea.textContent = '';

      if (document.execCommand) {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      }

      await this.sleep(200);

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (document.execCommand) {
          document.execCommand('insertText', false, char);
        } else {
          textArea.textContent += char;
          textArea.innerHTML = textArea.textContent;
        }

        textArea.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: char
        }));

        await this.sleep(Math.random() * 100 + 50);

        if (Math.random() < 0.1) {
          await this.sleep(Math.random() * 500 + 200);
        }
      }

      textArea.dispatchEvent(new Event('input', { bubbles: true }));
      textArea.dispatchEvent(new Event('change', { bubbles: true }));
      textArea.blur();
      textArea.focus();

    } else {

      textArea.value = '';

      for (let i = 0; i < text.length; i++) {
        textArea.value += text[i];
        textArea.dispatchEvent(new Event('input', { bubbles: true }));

        await this.sleep(Math.random() * 100 + 50);

        if (Math.random() < 0.1) {
          await this.sleep(Math.random() * 500 + 200);
        }
      }
    }
  }
};
