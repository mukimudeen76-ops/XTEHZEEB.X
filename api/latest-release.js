// /api/latest-release.js
// Runs only on Vercel's server — the GitHub token never reaches the browser.
// Requires these Environment Variables to be set in the Vercel project:
//   GITHUB_TOKEN  -> a fine-grained Personal Access Token with "Contents: Read-only"
//                    access on the target repo (works for private repos)
//   GITHUB_OWNER  -> e.g. "tehzeeb-dev"
//   GITHUB_REPO   -> e.g. "tehzeeb-ai-os"

export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: 'Server not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO in Vercel > Project > Settings > Environment Variables.'
    });
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'tehzeeb-ai-os-landing-page'
        }
      }
    );

    if (!ghRes.ok) {
      const details = await ghRes.text();
      return res.status(ghRes.status).json({
        error: `GitHub API returned ${ghRes.status}`,
        details
      });
    }

    const release = await ghRes.json();

    // Prefer the first uploaded build asset (e.g. an .apk/.zip/.exe you attach
    // to the release). Falls back to the auto-generated source zip if the
    // release has no uploaded assets.
    const asset = Array.isArray(release.assets) && release.assets.length > 0
      ? release.assets[0]
      : null;

    const payload = {
      version: release.tag_name,
      name: release.name || release.tag_name,
      publishedAt: release.published_at,
      downloadUrl: asset ? asset.browser_download_url : release.zipball_url,
      assetName: asset ? asset.name : 'source.zip',
      assetSize: asset ? asset.size : null
    };

    // Cache at the edge for 60s, allow serving a slightly stale copy for up to
    // 5 minutes while a fresh one is fetched in the background.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach GitHub', details: err.message });
  }
}

