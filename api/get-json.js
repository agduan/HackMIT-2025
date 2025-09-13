export default function handler(req, res) {
  try {
    const secretJson = JSON.parse(process.env.MY_JSON); // lives only on Vercel server
    res.status(200).json(secretJson);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load JSON' });
  }
}
