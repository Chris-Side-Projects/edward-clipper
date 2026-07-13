// Edward Clipper - popup.js  
const API_BASE = 'https://romantic-passion-production-903c.up.railway.app/api/clipper';
const API_KEY = 'NMYX51GDjQNzIOK4-Bg1xq-BixPP0OBNjSIt9nCcYI4';
const CF_CLIENT_ID = '48de711602759a9859d6a741a5237cc6.access';
const CF_CLIENT_SECRET = '904c7a30e719a36fddacac3680b4de47c4a40b1151f692a517692846f6556a60';

const statusEl = document.getElementById('status');
const connDot = document.getElementById('connDot');
const connStatus = document.getElementById('connStatus');
const captureBtn = document.getElementById('captureBtn');
const captureAllBtn = document.getElementById('captureAllBtn');
const docSendBtn = document.getElementById('docSendBtn');
const libraryBtn = document.getElementById('libraryBtn');
const tagInput = document.getElementById('tag');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}

// Check server connectivity
async function checkConnection() {
  try {
    const r = await fetch(API_BASE + '/ping', {
      method: 'GET',
      headers: {
        'CF-Access-Client-Id': CF_CLIENT_ID,
        'CF-Access-Client-Secret': CF_CLIENT_SECRET,
      },
    });
    if (r.ok) {
      connDot.className = 'dot green';
      connStatus.textContent = 'Connected to Edward Clipper';
      return true;
    }
  } catch {}
  connDot.className = 'dot red';
  connStatus.textContent = 'Cannot reach Edward Clipper';
  return false;
}

// Extract page content via content script injection
async function extractPageContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Extract all text
      const bodyText = document.body.innerText;

      // Extract all images
      const images = [...document.querySelectorAll('img')].map(img => ({
        src: img.src,
        alt: img.alt || '',
        width: img.naturalWidth,
        height: img.naturalHeight,
      })).filter(i => i.src && !i.src.startsWith('data:') && i.width > 50);

      // Extract all links
      const links = [...document.querySelectorAll('a[href]')].map(a => ({
        text: a.textContent?.trim().slice(0, 200) || '',
        href: a.href,
      })).filter(l => l.href.startsWith('http'));

      // Extract tables
      const tables = [...document.querySelectorAll('table')].map(table => {
        const rows = [...table.querySelectorAll('tr')].map(tr =>
          [...tr.querySelectorAll('th, td')].map(cell => cell.textContent?.trim() || '')
        );
        return rows;
      });

      // Extract meta tags
      const meta = {};
      document.querySelectorAll('meta[name], meta[property]').forEach(m => {
        const key = m.getAttribute('name') || m.getAttribute('property');
        if (key) meta[key] = m.getAttribute('content');
      });

      // Extract structured data (JSON-LD)
      const jsonLd = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try { jsonLd.push(JSON.parse(s.textContent)); } catch {}
      });

      // Extract headings structure
      const headings = [...document.querySelectorAll('h1, h2, h3, h4')].map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim().slice(0, 200) || '',
      }));

      // Extract forms / inputs (useful for data-heavy pages)
      const dataElements = [];
      document.querySelectorAll('[class*="price"], [class*="value"], [class*="amount"], [data-testid]').forEach(el => {
        dataElements.push({
          tag: el.tagName,
          class: el.className?.toString().slice(0, 100),
          text: el.textContent?.trim().slice(0, 500),
          testId: el.getAttribute('data-testid'),
        });
      });

      return {
        title: document.title,
        url: location.href,
        bodyText: bodyText.slice(0, 500000), // 500KB max
        headings,
        images: images.slice(0, 100),
        links: links.slice(0, 500),
        tables,
        meta,
        jsonLd,
        dataElements: dataElements.slice(0, 200),
        html: document.documentElement.outerHTML.slice(0, 2000000), // 2MB max
        timestamp: new Date().toISOString(),
      };
    },
  });

  return results[0]?.result;
}

// Capture screenshot
async function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      resolve(dataUrl);
    });
  });
}

// Main capture function
async function capturePage(tab) {
  const tag = tagInput.value.trim();

  setStatus('Extracting page content...', 'working');
  const content = await extractPageContent(tab.id);
  if (!content) {
    setStatus('Failed to extract content', 'error');
    return false;
  }

  setStatus('Taking screenshot...', 'working');
  const screenshot = await captureScreenshot();

  setStatus('Sending to Edward Clipper...', 'working');
  const payload = {
    ...content,
    screenshot, // base64 data URL
    tag: tag || null,
    capturedAt: new Date().toISOString(),
    tabId: tab.id,
    windowId: tab.windowId,
  };

  try {
    const r = await fetch(API_BASE + '/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clipper-key': API_KEY,
        'CF-Access-Client-Id': CF_CLIENT_ID,
        'CF-Access-Client-Secret': CF_CLIENT_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      const data = await r.json();
      setStatus(`✓ Saved: ${data.path}`, 'success');
      return true;
    } else {
      const err = await r.text();
      setStatus(`Server error: ${err}`, 'error');
      return false;
    }
  } catch (e) {
    setStatus(`Network error: ${e.message}`, 'error');
    return false;
  }
}

// Capture current tab
captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await capturePage(tab);
  } catch (e) {
    setStatus(`Error: ${e.message}`, 'error');
  }
  captureBtn.disabled = false;
});

// Capture all tabs
captureAllBtn.addEventListener('click', async () => {
  captureAllBtn.disabled = true;
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let success = 0;
    for (let i = 0; i < tabs.length; i++) {
      setStatus(`Capturing tab ${i + 1}/${tabs.length}...`, 'working');
      // Activate tab to screenshot it
      await chrome.tabs.update(tabs[i].id, { active: true });
      await new Promise(r => setTimeout(r, 500)); // Wait for render
      const ok = await capturePage(tabs[i]);
      if (ok) success++;
    }
    setStatus(`✓ Captured ${success}/${tabs.length} tabs`, 'success');
  } catch (e) {
    setStatus(`Error: ${e.message}`, 'error');
  }
  captureAllBtn.disabled = false;
});

// DocSend multi-page capture
docSendBtn.addEventListener('click', async () => {
  docSendBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if this is a DocSend URL
    if (!tab.url.includes('docsend.com')) {
      setStatus('Not a DocSend URL', 'error');
      return;
    }
    
    await captureDocSendMultiPage(tab);
  } catch (e) {
    setStatus(`Error: ${e.message}`, 'error');
  }
  docSendBtn.disabled = false;
});

// Library viewer
libraryBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://edsnip.com/clips' });
});

// DocSend multi-page capture function
async function captureDocSendMultiPage(tab) {
  setStatus('Detecting DocSend pages...', 'working');
  
  // Inject script to detect and navigate DocSend pages
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const pages = [];
      let currentPage = 1;
      let totalPages = 1;
      let attempts = 0;
      const maxAttempts = 80; // Support up to 80 pages as requested
      
      // Try to find page counter
      const pageIndicators = [
        '.page-counter', '.page-number', '[data-testid*="page"]', 
        '.slide-counter', '[class*="current"]', '[class*="page"]'
      ];
      
      const nextSelectors = [
        'button[data-testid="next"]', '.next-page', '.arrow-right',
        'button:contains("Next")', '[aria-label*="next"]', '.next-slide'
      ];
      
      function findPageInfo() {
        for (const selector of pageIndicators) {
          const elem = document.querySelector(selector);
          if (elem && elem.textContent) {
            const match = elem.textContent.match(/(\d+)\s*(?:\/|of)\s*(\d+)/);
            if (match) {
              return { current: parseInt(match[1]), total: parseInt(match[2]) };
            }
          }
        }
        return null;
      }
      
      function findNextButton() {
        for (const selector of nextSelectors) {
          const elem = document.querySelector(selector);
          if (elem && !elem.disabled && elem.offsetParent) {
            return elem;
          }
        }
        return null;
      }
      
      // Conservative anti-detection: randomized delays and user simulation
      function randomDelay(min = 3000, max = 6000) {
        return new Promise(resolve => 
          setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
        );
      }
      
      function simulateHumanClick(element) {
        // Simulate mouse movement and click
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 10;
        const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;
        
        const events = ['mouseover', 'mousedown', 'click', 'mouseup'];
        events.forEach((eventType, i) => {
          setTimeout(() => {
            const event = new MouseEvent(eventType, {
              bubbles: true,
              clientX: x,
              clientY: y
            });
            element.dispatchEvent(event);
          }, i * 50);
        });
      }
      
      // Initial page detection
      const pageInfo = findPageInfo();
      if (pageInfo) {
        totalPages = Math.min(pageInfo.total, maxAttempts);
        currentPage = pageInfo.current;
      }
      
      return {
        totalPages,
        currentPage,
        needsManualNavigation: !pageInfo,
        message: `Detected ${totalPages} pages. Starting capture...`
      };
    }
  });
  
  const docSendInfo = results[0]?.result;
  if (!docSendInfo) {
    setStatus('Failed to analyze DocSend document', 'error');
    return;
  }
  
  setStatus(docSendInfo.message, 'working');
  
  const allPages = [];
  let pageNumber = 1;
  const maxPages = Math.min(docSendInfo.totalPages || 80, 80); // Respect no session limits
  
  // Capture each page
  while (pageNumber <= maxPages) {
    setStatus(`Capturing page ${pageNumber}/${maxPages}...`, 'working');
    
    // Extract content and take screenshot
    const content = await extractPageContent(tab.id);
    const screenshot = await captureScreenshot();
    
    allPages.push({
      page: pageNumber,
      content,
      screenshot,
      capturedAt: new Date().toISOString()
    });
    
    if (pageNumber >= maxPages) break;
    
    // Navigate to next page with anti-detection
    const navResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const nextSelectors = [
          'button[data-testid="next"]', '.next-page', '.arrow-right',
          'button[aria-label*="next"]', '.next-slide'
        ];
        
        for (const selector of nextSelectors) {
          const elem = document.querySelector(selector);
          if (elem && !elem.disabled && elem.offsetParent) {
            // Simulate human click
            const rect = elem.getBoundingClientRect();
            const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 10;
            const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;
            
            const event = new MouseEvent('click', {
              bubbles: true,
              clientX: x,
              clientY: y
            });
            elem.dispatchEvent(event);
            return { success: true, method: selector };
          }
        }
        return { success: false, error: 'No next button found' };
      }
    });
    
    if (!navResult[0]?.result?.success) {
      setStatus(`Captured ${pageNumber} pages (navigation ended)`, 'success');
      break;
    }
    
    // Conservative delay between pages (3-6 seconds + jitter)
    const delay = 3000 + Math.random() * 3000 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    pageNumber++;
  }
  
  // Combine all pages into one submission
  setStatus('Combining pages and uploading...', 'working');
  
  const tag = tagInput.value.trim();
  const firstPage = allPages[0];
  
  // Create combined payload
  const combinedPayload = {
    ...firstPage.content,
    tag: tag || 'docsend-multipage',
    capturedAt: new Date().toISOString(),
    format: 'multipage',
    pageCount: allPages.length,
    pages: allPages.map(p => ({
      page: p.page,
      screenshot: p.screenshot,
      timestamp: p.capturedAt
    }))
  };
  
  // Use the last screenshot as the primary one (or create a composite)
  combinedPayload.screenshot = allPages[allPages.length - 1].screenshot;
  
  try {
    const r = await fetch(API_BASE + '/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clipper-key': API_KEY,
        'CF-Access-Client-Id': CF_CLIENT_ID,
        'CF-Access-Client-Secret': CF_CLIENT_SECRET,
      },
      body: JSON.stringify(combinedPayload),
    });

    if (r.ok) {
      const data = await r.json();
      setStatus(`✓ Saved ${allPages.length} pages: ${data.path}`, 'success');
    } else {
      const err = await r.text();
      setStatus(`Server error: ${err}`, 'error');
    }
  } catch (e) {
    setStatus(`Network error: ${e.message}`, 'error');
  }
}

// Init
checkConnection();
