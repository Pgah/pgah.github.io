export function GET() {
  const url = 'https://www.youtube.com/watch?v=ztABYog5x3o';
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<script type="text/javascript">//<![CDATA[
window.location.replace("${url}");
//]]></script>
</head>
<body>
<p>Redirecting to <a href="${url}">Matrix</a>...</p>
</body>
</html>`
  );
}
