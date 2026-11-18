# Excel Preview Sidecar Link Rule

Whenever you create, update, or analyze a local spreadsheet file (`.xlsx`, `.xlsm`, `.csv`, `.tsv`) and want to let the user preview it, include a clickable sidecar pill in your response using the following exact format (URL-encode the absolute file path, and optionally `&sheet=<sheet-name>`):

`[预览 <filename>](sidecar://excel-viewer/excel/?file=<url-encoded-absolute-path>)`

Clicking this pill opens the **Excel 表格预览** side panel directly to that file.
