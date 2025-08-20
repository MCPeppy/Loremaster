document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('input-form');
  const namesSection = document.getElementById('names-section');
  const worldSection = document.getElementById('world-section');
  const speciesNameEl = document.getElementById('species-name');
  const civNameEl = document.getElementById('civilization-name');
  const speciesImage = document.getElementById('species-image');

  let currentData = {};

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const animal = document.getElementById('animal').value.trim();
    const culture = document.getElementById('culture').value.trim();
    const spice = document.getElementById('spice').value.trim();
    if (!animal || !culture || !spice) return;

    namesSection.classList.add('hidden');
    worldSection.classList.add('hidden');

    try {
      // Request species and civilization names
      const res = await fetch('/api/generate-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animal, culture, spice }),
      });
      const data = await res.json();
      currentData = { animal, culture, spice, speciesName: data.speciesName, civilizationName: data.civilizationName };
      speciesNameEl.textContent = data.speciesName;
      civNameEl.textContent = data.civilizationName;

      // Request a preview image for the species
      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animal, culture, spice, speciesName: data.speciesName }),
      });
      const imgData = await imgRes.json();
      if (imgData && imgData.imageUrl) {
        speciesImage.src = imgData.imageUrl;
      } else {
        speciesImage.removeAttribute('src');
      }

      namesSection.classList.remove('hidden');
    } catch (err) {
      console.error('Error generating names or image:', err);
      alert('There was an error generating names or image. Please try again.');
    }
  });

  // Retry button calls the submit handler again
  document.getElementById('retry-names').addEventListener('click', () => {
    form.dispatchEvent(new Event('submit'));
  });

  // Edit button allows the user to modify the generated names
  document.getElementById('edit-names').addEventListener('click', () => {
    const newSpecies = prompt('Edit species name:', currentData.speciesName);
    if (newSpecies !== null && newSpecies.trim() !== '') {
      currentData.speciesName = newSpecies.trim();
      speciesNameEl.textContent = newSpecies.trim();
    }
    const newCiv = prompt('Edit civilization name:', currentData.civilizationName);
    if (newCiv !== null && newCiv.trim() !== '') {
      currentData.civilizationName = newCiv.trim();
      civNameEl.textContent = newCiv.trim();
    }
  });

  // Proceed button triggers full world generation
  document.getElementById('proceed-button').addEventListener('click', async () => {
    if (!currentData.speciesName || !currentData.civilizationName) return;

    worldSection.classList.remove('hidden');
    const contentDiv = worldSection.querySelector('#world-content');
    contentDiv.innerHTML = '<p>Generating world… please wait.</p>';

    try {
      const res = await fetch('/api/generate-world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData),
      });
      const data = await res.json();

      if (data.error) {
        contentDiv.innerHTML = `<p>Error: ${data.error}</p>`;
        return;
      }

      // Display generated sections
      contentDiv.innerHTML = '';
      if (data.sections && Array.isArray(data.sections)) {
        data.sections.forEach((section) => {
          const sectionEl = document.createElement('section');
          const h3 = document.createElement('h3');
          h3.textContent = section.title;
          sectionEl.appendChild(h3);

          const div = document.createElement('div');
          div.innerHTML = section.content || section.html || '';
          sectionEl.appendChild(div);

          if (section.imageUrl) {
            const img = document.createElement('img');
            img.src = section.imageUrl;
            img.alt = section.title;
            img.style.maxWidth = '100%';
            img.style.marginTop = '10px';
            sectionEl.appendChild(img);
          }
          contentDiv.appendChild(sectionEl);
        });
      } else if (data.html) {
        contentDiv.innerHTML = data.html;
      }

      // Show download links if available
      const downloadOptions = document.getElementById('download-options');
      if (data.pdfUrl) {
        document.getElementById('download-link').href = data.pdfUrl;
      }
      if (data.imagesZipUrl) {
        document.getElementById('images-link').href = data.imagesZipUrl;
      }
      if (data.modelUrl) {
        document.getElementById('model-link').href = data.modelUrl;
      }
      if (data.pdfUrl || data.imagesZipUrl || data.modelUrl) {
        downloadOptions.classList.remove('hidden');
      }

    } catch (err) {
      console.error('Error generating world:', err);
      contentDiv.innerHTML = '<p>There was an error generating the world. Please try again later.</p>';
    }
  });
});
