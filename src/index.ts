import joplin from 'api';
// const uslug = require('@joplin/fork-uslug');
const uslug = require('uslug');

let slugs = {};

// Register the plugin
joplin.plugins.register({
  onStart: async function () {
    // Create the panel object
    const panel = await joplin.views.panels.create('panel_1');

    // Add the CSS file to the view, right after it has been created:
    await joplin.views.panels.addScript(panel, './webview.css');

    // Add the JS file
    await joplin.views.panels.addScript(panel, './webview.js');

    // Set some initial content while the TOC is being created
    await joplin.views.panels.setHtml(panel, 'Loading...');

    await joplin.views.panels.onMessage(panel, (message) => {
      if (message.name === 'scrollToHash') {
        // As the name says, the scrollToHash command makes the note scroll
        // to the provided hash.
        joplin.commands.execute('scrollToHash', message.hash);
      }
    });

    // Later, this is where you'll want to update the TOC
    async function updateTocView() {
      // Get the current note from the workspace.
      const note = await joplin.workspace.selectedNote();

      slugs = {}; // Reset the slugs

      // Keep in mind that it can be `null` if nothing is currently selected!
      if (note) {
        const headers = noteHeaders(note.body);
        console.info('The note has the following headers', headers);

        // First create the HTML for each header:
        const itemHtml = [];
        for (const header of headers) {
          const slug = headerSlug(header.text);

          // - We indent each header based on header.level.
          //
          // - The slug will be needed later on once we implement clicking on a header.
          //   We assign it to a "data" attribute, which can then be easily retrieved from JavaScript
          //
          // - Also make sure you escape the text before inserting it in the HTML to avoid XSS attacks
          //   and rendering issues. For this use the `escapeHtml()` function you've added earlier.
          itemHtml.push(`
                        <p class="toc-item" style="padding-left:${(header.level - 1) * 15}px">
                            <a class="toc-item-link" href="#" data-slug="${escapeHtml(slug)}">
                                ${escapeHtml(header.text)}
                            </a>
                        </p>
                    `);
        }

        // Finally, insert all the headers in a container and set the webview HTML:
        await joplin.views.panels.setHtml(
          panel,
          `
                    <div class="container">
                        ${itemHtml.join('\n')}
                    </div>
                `,
        );
      } else {
        await joplin.views.panels.setHtml(
          panel,
          'Please select a note to view the table of content',
        );
      }
    }

    // This event will be triggered when the user selects a different note
    await joplin.workspace.onNoteSelectionChange(() => {
      updateTocView();
    });

    // This event will be triggered when the content of the note changes
    // as you also want to update the TOC in this case.
    await joplin.workspace.onNoteChange(() => {
      updateTocView();
    });

    // Also update the TOC when the plugin starts
    updateTocView();
  },
});

/**
 * Text and level (H1, H2, etc.) of header
 * @param noteBody The note content
 * @returns Return an array of headers
 */
function noteHeaders(noteBody: string) {
  const headers = [];
  const lines = noteBody.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#+)\s(.*)*/);
    if (!match) continue;
    headers.push({
      level: match[1].length,
      text: match[2],
    });
  }
  return headers;
}

/**
 * Generate the slug for each header. A slug is an identifier which is used to link to a particular header.
 * @param headerText Header text
 * @returns The slug
 */
function headerSlug(headerText: string) {
  const s = uslug(headerText);
  let num = slugs[s] ? slugs[s] : 1;
  const output = [s];
  if (num > 1) output.push(num);
  slugs[s] = num + 1;
  return output.join('-');
}

// From https://stackoverflow.com/a/6234804/561309
function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
