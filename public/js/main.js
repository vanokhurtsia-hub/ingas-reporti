// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('open');
  });
}

// Color picker live preview
const colorPicker = document.getElementById('colorPicker');
const colorValue = document.getElementById('colorValue');
if (colorPicker && colorValue) {
  colorPicker.addEventListener('input', () => {
    colorValue.textContent = colorPicker.value;
  });
}

// Auto-dismiss alerts
setTimeout(() => {
  document.querySelectorAll('.alert').forEach(el => {
    el.style.transition = 'opacity 0.5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  });
}, 4000);
