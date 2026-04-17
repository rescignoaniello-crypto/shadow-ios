let s='';
process.stdin.on('data', d => s+=d);
process.stdin.on('end', () => {
  const j = JSON.parse(s);
  j.nodes.forEach(n => {
    const str = JSON.stringify(n).toLowerCase();
    if (str.includes('usd_bs') || str.includes('datatable') || str.includes('datastore') || n.type.toLowerCase().includes('data')) {
      console.log('--node--', n.name, '| type:', n.type);
      console.log(JSON.stringify(n.parameters, null, 2).slice(0, 1200));
      if (n.credentials) console.log('creds:', JSON.stringify(n.credentials));
    }
  });
});
