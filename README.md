# Paper Reading Dashboard

A simple local webpage for tracking paper reading notes.

## Files

- `index.html` - page structure and form
- `style.css` - simple visual styling
- `script.js` - form handling, card rendering, filters, and localStorage
- `vendor/html2canvas.min.js` - local browser library used for JPG card export

## How to Open

Open `index.html` directly in a browser.

You can double-click the file in Windows Explorer, or open it from your browser with:

```text
D:\CodexWorkspace\project\index.html
```

## How to Test

1. Open the page.
2. Fill in the paper form.
3. Click `Add Paper`.
4. Confirm the paper appears as a card under `Saved Papers`.
5. Refresh the page.
6. Confirm the card is still there. This verifies browser `localStorage`.
7. Use the `Status` dropdown to filter by reading status.
8. Use the search box to search by `Paper Title` or `Method`.
9. Use `Edit` to revise a saved paper.
10. Use `Delete` to remove a saved paper after confirmation.
11. Add a required `Paper Link` before saving a new paper.
12. Optionally attach an original PDF file. The PDF is saved locally in the browser.
13. Use `Export JPG` on a paper card to download that card as a JPG image.

## Data Storage

The dashboard stores paper text data in browser `localStorage` under this key:

```text
esgPapers
```

The saved data is an array of paper objects with this structure:

```js
[
  {
    title,
    link,
    question,
    data,
    method,
    findings,
    notes,
    status,
    pdfName,
    pdfId
  }
]
```

PDF files are stored separately in browser `IndexedDB` under the database name:

```text
esgPaperPdfs
```

Because this is a no-backend local webpage, the PDF is stored only in the current browser profile. If browser site data is cleared, saved records and PDFs may be removed.

