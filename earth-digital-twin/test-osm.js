import fs from 'fs';

const bboxStr = '40.6,-74.05,40.8,-73.9';
const query = `[out:json][timeout:25];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](${bboxStr});
);
out body;>;out skel qt;`;

async function test() {
  console.log('Fetching from Overpass...');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`
  });
  
  if (!res.ok) {
    console.error('Failed', res.status, res.statusText);
    return;
  }
  
  const data = await res.json();
  const ways = data.elements.filter(e => e.type === 'way');
  console.log(`Found ${ways.length} ways out of ${data.elements.length} elements`);
}

test();
