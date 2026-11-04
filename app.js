// ============================================
// AI Vision - App Logic
// ============================================

let currentImageUrl = '';
let gallery = JSON.parse(localStorage.getItem('ai_vision_gallery')) || [];

// عناصر الواجهة
const promptInput = document.getElementById('promptInput');
const styleSelect = document.getElementById('styleSelect');
const sizeSelect = document.getElementById('sizeSelect');
const negativePrompt = document.getElementById('negativePrompt');
const seedInput = document.getElementById('seedInput');
const generateBtn = document.getElementById('generateBtn');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const resultPrompt = document.getElementById('resultPrompt');
const loadingSection = document.getElementById('loadingSection');
const gallerySection = document.getElementById('gallerySection');
const galleryGrid = document.getElementById('galleryGrid');

// إظهار/إخفاء الإعدادات المتقدمة
function toggleAdvanced() {
  document.getElementById('advancedOptions').classList.toggle('active');
}

// دالة التوليد الرئيسية
async function generateImage() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showToast('⚠️ يرجى كتابة وصف للصورة أولاً');
    return;
  }
  
  // تجهيز الواجهة
  resultSection.style.display = 'none';
  gallerySection.style.display = 'none';
  loadingSection.style.display = 'block';
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> جاري التوليد...';
  
  try {
    // تجهيز الوصف النهائي مع النمط
    const style = styleSelect.value ? ', ' + styleSelect.value : '';
    const finalPrompt = prompt + style;
    
    // الأبعاد
    const [width, height] = sizeSelect.value.split('x');
    
    // بناء رابط الـ API (Pollinations - مجاني وبدون مفتاح)
    let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&nologo=true`;
    
    // إضافة الوصف السلبي لو موجود
    if (negativePrompt.value.trim()) {
      url += `&negative_prompt=${encodeURIComponent(negativePrompt.value.trim())}`;
    }
    
    // إضافة الـ Seed لو موجود
    if (seedInput.value.trim()) {
      url += `&seed=${seedInput.value.trim()}`;
    } else {
      url += `&seed=${Math.floor(Math.random() * 1000000)}`; // عشوائي
    }
    
    // طلب الصورة
    const response = await fetch(url);
    if (!response.ok) throw new Error('فشل في توليد الصورة');
    
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    
    // عرض النتيجة
    currentImageUrl = imageUrl;
    resultImage.src = imageUrl;
    resultPrompt.innerText = prompt;
    
    // الحفظ في المعرض
    saveToGallery(imageUrl, prompt);
    
    // إخفاء التحميل وإظهار النتيجة
    loadingSection.style.display = 'none';
    resultSection.style.display = 'block';
    showToast('✨ تم توليد الصورة بنجاح');
    
  } catch (error) {
    console.error(error);
    loadingSection.style.display = 'none';
    showToast('❌ حدث خطأ، يرجى المحاولة مرة أخرى');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> توليد الصورة';
  }
}

// حفظ الصورة في المعرض (عن طريق تحويلها لـ Base64 عشان تتحفظ في الـ LocalStorage)
function saveToGallery(url, prompt) {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result;
        // إضافة الصورة في بداية المصفوفة
        gallery.unshift({ id: Date.now(), data: base64data, prompt: prompt });
        // الاحتفاظ بآخر 20 صورة فقط عشان الذاكرة
        if (gallery.length > 20) gallery.pop();
        localStorage.setItem('ai_vision_gallery', JSON.stringify(gallery));
        renderGallery();
      };
      reader.readAsDataURL(blob);
    });
}

// تحميل الصورة على الجهاز
function downloadImage() {
  if (!currentImageUrl) return;
  const a = document.createElement('a');
  a.href = currentImageUrl;
  a.download = `AI-Vision-${Date.now()}.jpg`;
  a.click();
  showToast('📥 جاري التحميل...');
}

// حذف الصورة المعروضة حالياً
function deleteCurrentImage() {
  resultSection.style.display = 'none';
  currentImageUrl = '';
  showToast('🗑️ تم إخفاء الصورة');
}

// عرض المعرض
function toggleGallery() {
  if (gallerySection.style.display === 'none') {
    resultSection.style.display = 'none';
    loadingSection.style.display = 'none';
    gallerySection.style.display = 'block';
    renderGallery();
  } else {
    gallerySection.style.display = 'none';
  }
}

// رسم شبكة المعرض
function renderGallery() {
  galleryGrid.innerHTML = '';
  if (gallery.length === 0) {
    galleryGrid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--text-muted); margin-top: 20px;">المعرض فارغ</p>';
    return;
  }
  
  gallery.forEach(img => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `<img src="${img.data}" alt="Generated" onclick="viewGalleryImage('${img.data}', '${img.prompt.replace(/'/g, "\\'")}')">`;
    galleryGrid.appendChild(div);
  });
}

// عرض صورة من المعرض في الشاشة الرئيسية
function viewGalleryImage(dataUrl, prompt) {
  gallerySection.style.display = 'none';
  resultSection.style.display = 'block';
  currentImageUrl = dataUrl;
  resultImage.src = dataUrl;
  resultPrompt.innerText = prompt;
}

// مسح المعرض بالكامل
function clearGallery() {
  if (confirm('هل تريدين مسح كل الصور من المعرض؟')) {
    gallery = [];
    localStorage.removeItem('ai_vision_gallery');
    renderGallery();
    showToast('🗑️ تم مسح المعرض');
  }
}

// إظهار رسائل التنبيه
function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// عند فتح التطبيق
window.onload = () => {
  renderGallery();
};