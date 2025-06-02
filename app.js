/*
const namespaceSelect = document.getElementById('namespaceSelect');
const serviceCheckboxContainer = document.getElementById('serviceCheckboxContainer');
const sliderWrapper = document.getElementById('slider-wrapper');
const unlockBtn = document.getElementById('unlock-btn');
const deployToggle = document.getElementById('deploy-toggle');
const deployTimeSelect = document.getElementById('deploy-time-select');
const deployBtn = document.getElementById('deploy-btn');

const allServices = {
  default: ['nginx', 'api'],
  dev: ['dev-backend', 'dev-frontend'],
  prod: ['prod-api', 'prod-web']
};

const selectedServices = {};
const availableVersions = ['image:1', 'image:2', 'image:3'];
let isLocked = false;

// 네임스페이스 옵션 추가
Object.keys(allServices).forEach(ns => {
  const option = document.createElement('option');
  option.value = ns;
  option.textContent = ns;
  namespaceSelect.appendChild(option);
});

// ✅ 유효성 검사 함수
function checkFormValid() {
  const ns = namespaceSelect.value;
  if (!ns || !selectedServices[ns] || selectedServices[ns].length === 0) {
    deployBtn.disabled = true;
    return;
  }

  const allSelected = selectedServices[ns].every(service => {
    const left = document.getElementById(`${ns}-${service}-left`);
    const right = document.getElementById(`${ns}-${service}-right`);
    return left?.value && right?.value;
  });

  deployBtn.disabled = !allSelected;
}

// 👉 라벨 없이 드롭다운만 묶는 함수
function createDropdownWrapper(dropdown) {
  const wrapper = document.createElement('div');
  wrapper.style.margin = '0 10px';
  wrapper.appendChild(dropdown);
  return wrapper;
}

// 슬라이더 생성
function createSlider(namespace, serviceName) {
  const sliderId = `${namespace}-${serviceName}`;
  if (document.getElementById(`slider-${sliderId}`)) return;

  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'slider-container';
  sliderContainer.id = `slider-${sliderId}`;

  const label = document.createElement('label');
  label.textContent = `[${namespace}] ${serviceName}`;
  label.setAttribute('for', `range-${sliderId}`);

  const labelDiv = document.createElement('div');
  labelDiv.className = 'slider-label';

  const versionLeft = createVersionDropdown(`${sliderId}-left`);
  const versionRight = createVersionDropdown(`${sliderId}-right`);
  versionLeft.classList.add('slider-version-select');
  versionRight.classList.add('slider-version-select');

  versionLeft.addEventListener('change', () => {
    updateVersionOptions(versionLeft, versionRight);
    checkFormValid();
  });
  versionRight.addEventListener('change', () => {
    updateVersionOptions(versionRight, versionLeft);
    checkFormValid();
  });

  labelDiv.style.display = 'flex';
  labelDiv.appendChild(createDropdownWrapper(versionLeft));
  labelDiv.appendChild(createDropdownWrapper(versionRight));

  const input = document.createElement('input');
  input.type = 'range';
  input.min = 0;
  input.max = 100;
  input.value = 50;
  input.className = 'traffic-slider';
  input.id = `range-${sliderId}`;
  input.dataset.namespace = namespace;
  input.dataset.service = serviceName;
  input.disabled = isLocked;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'slider-value';
  valueSpan.textContent = `${input.value}%`;

  input.addEventListener('input', () => {
    valueSpan.textContent = `${input.value}%`;
  });
  

  sliderContainer.appendChild(label);
  sliderContainer.appendChild(labelDiv);
  sliderContainer.appendChild(input);
  sliderContainer.appendChild(valueSpan);
  sliderWrapper.appendChild(sliderContainer);

  updateVersionOptions(versionLeft, versionRight);
  checkFormValid();
}

// 버전 드롭다운
function createVersionDropdown(id) {
  const select = document.createElement('select');
  select.id = id;

  const emptyOption = document.createElement('option');
  emptyOption.value = "";
  emptyOption.textContent = "버전 선택";
  emptyOption.selected = true;
  emptyOption.disabled = true;
  select.appendChild(emptyOption);

  availableVersions.forEach(ver => {
    const option = document.createElement('option');
    option.value = ver;
    option.textContent = ver;
    select.appendChild(option);
  });

  select.disabled = isLocked;
  return select;
}

// 버전 중복 방지
function updateVersionOptions(changed, target) {
  const selected = changed.value;
  Array.from(target.options).forEach(opt => {
    opt.disabled = opt.value === selected;
  });
}

// 서비스 체크박스
function updateServiceCheckboxes(namespace) {
  serviceCheckboxContainer.innerHTML = '';

  const services = allServices[namespace] || [];
  if (!selectedServices[namespace]) selectedServices[namespace] = [];

  services.forEach(service => {
    const checkboxId = `chk-${namespace}-${service}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.dataset.namespace = namespace;
    checkbox.dataset.service = service;
    checkbox.value = service;
    checkbox.disabled = isLocked;

    if (selectedServices[namespace].includes(service)) {
      checkbox.checked = true;
      createSlider(namespace, service);
    }

    checkbox.addEventListener('change', () => {
      const ns = checkbox.dataset.namespace;
      const svc = checkbox.dataset.service;

      if (!selectedServices[ns]) selectedServices[ns] = [];

      if (checkbox.checked) {
        if (!selectedServices[ns].includes(svc)) {
          selectedServices[ns].push(svc);
          createSlider(ns, svc);
        }
      } else {
        selectedServices[ns] = selectedServices[ns].filter(s => s !== svc);
        const sliderElement = document.getElementById(`slider-${ns}-${svc}`);
        if (sliderElement) sliderElement.remove();
      }
      checkFormValid();
    });

    const label = document.createElement('label');
    label.setAttribute('for', checkboxId);
    label.textContent = service;

    const wrapper = document.createElement('div');
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);

    serviceCheckboxContainer.appendChild(wrapper);
  });

  checkFormValid();
}

// 네임스페이스 변경
namespaceSelect.addEventListener('change', () => {
  const ns = namespaceSelect.value;
  if (ns) {
    updateServiceCheckboxes(ns);
  } else {
    serviceCheckboxContainer.innerHTML = '';
    sliderWrapper.innerHTML = '';
  }
});

// 잠금 토글
unlockBtn.addEventListener('click', () => {
  isLocked = !isLocked;

  document.querySelectorAll('.traffic-slider').forEach(slider => slider.disabled = isLocked);
  document.querySelectorAll('.slider-version-select').forEach(select => select.disabled = isLocked);
  document.querySelectorAll('#serviceCheckboxContainer input[type="checkbox"]').forEach(cb => cb.disabled = isLocked);
  deployToggle.disabled = isLocked;
  deployTimeSelect.disabled = isLocked;

  unlockBtn.textContent = isLocked ? '잠금 풀기' : '잠금';

  // 스타일 토글 예시 (클래스 토글)
  if (isLocked) {
    unlockBtn.classList.add('locked');
    unlockBtn.classList.remove('unlocked');
  } else {
    unlockBtn.classList.remove('locked');
    unlockBtn.classList.add('unlocked');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const unlockBtn = document.getElementById('unlock-btn');
  let isLocked = false;

  unlockBtn.addEventListener('click', () => {
    isLocked = !isLocked;
    unlockBtn.textContent = isLocked ? '잠금 풀기' : '잠금';
  });
});


//데이터 저장해서 백엔드 넘겨주기 콘솔로 실험
deployBtn.addEventListener('click', () => {
  const stickySession = deployToggle.checked;
  const deployData = {
    stickySession,
    services: [],
  };

  // 모든 네임스페이스 돌면서 선택된 서비스와 상태를 수집
  Object.keys(selectedServices).forEach(ns => {
    selectedServices[ns].forEach(service => {
      const sliderId = `${ns}-${service}`;
      const slider = document.getElementById(`range-${sliderId}`);
      const versionLeft = document.getElementById(`${sliderId}-left`);
      const versionRight = document.getElementById(`${sliderId}-right`);

      if (slider && versionLeft && versionRight) {
        deployData.services.push({
          namespace: ns,
          name: service,
          trafficPercent: slider.value,
          versionLeft: versionLeft.value,
          versionRight: versionRight.value,
        });
      }
    });
  });

  console.log('배포 정보:', deployData);
});
*/


const namespaceSelect = document.getElementById('namespaceSelect');
const serviceCheckboxContainer = document.getElementById('serviceCheckboxContainer');
const sliderWrapper = document.getElementById('slider-wrapper');
const unlockBtn = document.getElementById('unlock-btn');
const deployToggle = document.getElementById('deploy-toggle');
const deployTimeSelect = document.getElementById('deploy-time-select');
const deployBtn = document.getElementById('deploy-btn');

const allServices = {
  default: ['nginx', 'api'],
  dev: ['dev-backend', 'dev-frontend'],
  prod: ['prod-api', 'prod-web']
};

const selectedServices = {};
const availableVersions = ['image:1', 'image:2', 'image:3'];
let isLocked = false;

// 네임스페이스 옵션 추가
Object.keys(allServices).forEach(ns => {
  const option = document.createElement('option');
  option.value = ns;
  option.textContent = ns;
  namespaceSelect.appendChild(option);
});

// ✅ 유효성 검사 함수
function checkFormValid() {
  const ns = namespaceSelect.value;
  if (!ns || !selectedServices[ns] || selectedServices[ns].length === 0) {
    deployBtn.disabled = true;
    return;
  }

  const allSelected = selectedServices[ns].every(service => {
    const left = document.getElementById(`${ns}-${service}-left`);
    const right = document.getElementById(`${ns}-${service}-right`);
    return left?.value && right?.value;
  });

  deployBtn.disabled = !allSelected;
}

// 👉 라벨 없이 드롭다운만 묶는 함수
function createDropdownWrapper(dropdown) {
  const wrapper = document.createElement('div');
  wrapper.style.margin = '0 10px';
  wrapper.appendChild(dropdown);
  return wrapper;
}

// 슬라이더 생성
function createSlider(namespace, serviceName) {
  const sliderId = `${namespace}-${serviceName}`;
  if (document.getElementById(`slider-${sliderId}`)) return;

  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'slider-container';
  sliderContainer.id = `slider-${sliderId}`;

  const label = document.createElement('label');
  label.textContent = `[${namespace}] ${serviceName}`;
  label.setAttribute('for', `range-${sliderId}`);

  const labelDiv = document.createElement('div');
  labelDiv.className = 'slider-label';

  const versionLeft = createVersionDropdown(`${sliderId}-left`);
  const versionRight = createVersionDropdown(`${sliderId}-right`);
  versionLeft.classList.add('slider-version-select');
  versionRight.classList.add('slider-version-select');

  versionLeft.addEventListener('change', () => {
    updateVersionOptions(versionLeft, versionRight);
    checkFormValid();
  });
  versionRight.addEventListener('change', () => {
    updateVersionOptions(versionRight, versionLeft);
    checkFormValid();
  });

  labelDiv.style.display = 'flex';
  labelDiv.appendChild(createDropdownWrapper(versionLeft));
  labelDiv.appendChild(createDropdownWrapper(versionRight));

  const input = document.createElement('input');
  input.type = 'range';
  input.min = 0;
  input.max = 100;
  input.value = 50;
  input.className = 'traffic-slider';
  input.id = `range-${sliderId}`;
  input.dataset.namespace = namespace;
  input.dataset.service = serviceName;
  input.disabled = isLocked;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'slider-value';
  valueSpan.textContent = `${input.value}%`;

  input.addEventListener('input', () => {
    valueSpan.textContent = `${input.value}%`;
  });

  // sticky session 스위치 생성 (텍스트와 스위치 분리)
  const stickyWrapper = document.createElement('div');
  stickyWrapper.className = 'sticky-switch-wrapper';

  // 텍스트 라벨 따로
  const stickyText = document.createElement('span');
  stickyText.textContent = 'Sticky Session';
  stickyText.style.marginRight = '10px';

  // 스위치 라벨
  const stickyLabel = document.createElement('label');
  stickyLabel.className = 'switch';

  const stickyInput = document.createElement('input');
  stickyInput.type = 'checkbox';
  stickyInput.id = `sticky-${sliderId}`;
  stickyInput.disabled = isLocked;

  const stickySlider = document.createElement('span');
  stickySlider.className = 'slider-switch';

  stickyLabel.appendChild(stickyInput);
  stickyLabel.appendChild(stickySlider);

  stickyWrapper.appendChild(stickyText);
  stickyWrapper.appendChild(stickyLabel);

  sliderContainer.appendChild(label);
  sliderContainer.appendChild(labelDiv);
  sliderContainer.appendChild(input);
  sliderContainer.appendChild(valueSpan);
  sliderContainer.appendChild(stickyWrapper);

  sliderWrapper.appendChild(sliderContainer);

  updateVersionOptions(versionLeft, versionRight);
  checkFormValid();
}


// 버전 드롭다운
function createVersionDropdown(id) {
  const select = document.createElement('select');
  select.id = id;

  const emptyOption = document.createElement('option');
  emptyOption.value = "";
  emptyOption.textContent = "버전 선택";
  emptyOption.selected = true;
  emptyOption.disabled = true;
  select.appendChild(emptyOption);

  availableVersions.forEach(ver => {
    const option = document.createElement('option');
    option.value = ver;
    option.textContent = ver;
    select.appendChild(option);
  });

  select.disabled = isLocked;
  return select;
}

// 버전 중복 방지
function updateVersionOptions(changed, target) {
  const selected = changed.value;
  Array.from(target.options).forEach(opt => {
    opt.disabled = opt.value === selected;
  });
}

// 서비스 체크박스
function updateServiceCheckboxes(namespace) {
  serviceCheckboxContainer.innerHTML = '';

  const services = allServices[namespace] || [];
  if (!selectedServices[namespace]) selectedServices[namespace] = [];

  services.forEach(service => {
    const checkboxId = `chk-${namespace}-${service}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.dataset.namespace = namespace;
    checkbox.dataset.service = service;
    checkbox.value = service;
    checkbox.disabled = isLocked;

    if (selectedServices[namespace].includes(service)) {
      checkbox.checked = true;
      createSlider(namespace, service);
    }

    checkbox.addEventListener('change', () => {
      const ns = checkbox.dataset.namespace;
      const svc = checkbox.dataset.service;

      if (!selectedServices[ns]) selectedServices[ns] = [];

      if (checkbox.checked) {
        if (!selectedServices[ns].includes(svc)) {
          selectedServices[ns].push(svc);
          createSlider(ns, svc);
        }
      } else {
        selectedServices[ns] = selectedServices[ns].filter(s => s !== svc);
        const sliderElement = document.getElementById(`slider-${ns}-${svc}`);
        if (sliderElement) sliderElement.remove();
      }
      checkFormValid();
    });

    const label = document.createElement('label');
    label.setAttribute('for', checkboxId);
    label.textContent = service;

    const wrapper = document.createElement('div');
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);

    serviceCheckboxContainer.appendChild(wrapper);
  });

  checkFormValid();
}

// 네임스페이스 변경
namespaceSelect.addEventListener('change', () => {
  const ns = namespaceSelect.value;
  if (ns) {
    updateServiceCheckboxes(ns);
  } else {
    serviceCheckboxContainer.innerHTML = '';
    sliderWrapper.innerHTML = '';
  }
});

// 잠금 토글
unlockBtn.addEventListener('click', () => {
  isLocked = !isLocked;

  document.querySelectorAll('.traffic-slider').forEach(slider => slider.disabled = isLocked);
  document.querySelectorAll('.slider-version-select').forEach(select => select.disabled = isLocked);
  document.querySelectorAll('#serviceCheckboxContainer input[type="checkbox"]').forEach(cb => cb.disabled = isLocked);
  deployToggle.disabled = isLocked;
  deployTimeSelect.disabled = isLocked;

  unlockBtn.textContent = isLocked ? '잠금 풀기' : '잠금';

  // 스타일 토글 예시 (클래스 토글)
  if (isLocked) {
    unlockBtn.classList.add('locked');
    unlockBtn.classList.remove('unlocked');
  } else {
    unlockBtn.classList.remove('locked');
    unlockBtn.classList.add('unlocked');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const unlockBtn = document.getElementById('unlock-btn');
  let isLocked = false;

  unlockBtn.addEventListener('click', () => {
    isLocked = !isLocked;
    unlockBtn.textContent = isLocked ? '잠금 풀기' : '잠금';
  });
});


//데이터 저장해서 백엔드 넘겨주기 콘솔로 실험
deployBtn.addEventListener('click', () => {
  const deployData = { services: [] };

  Object.keys(selectedServices).forEach(ns => {
    selectedServices[ns].forEach(service => {
      const sliderId = `${ns}-${service}`;
      const slider = document.getElementById(`range-${sliderId}`);
      const versionLeft = document.getElementById(`${sliderId}-left`);
      const versionRight = document.getElementById(`${sliderId}-right`);
      const stickyInput = document.getElementById(`sticky-${sliderId}`);

      if (!slider || !versionLeft || !versionRight || !stickyInput) {
        console.warn(`Missing element for sliderId: ${sliderId}`, { slider, versionLeft, versionRight, stickyInput });
        return; // 요소가 하나라도 없으면 이 서비스는 무시
      }

      deployData.services.push({
        namespace: ns,
        name: service,
        trafficPercent: slider.value,
        versionLeft: versionLeft.value,
        versionRight: versionRight.value,
        stickySession: stickyInput.checked,
      });
    });
  });

  console.log('배포 정보:', deployData);
});

