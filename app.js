document.addEventListener('DOMContentLoaded', () => {
  const namespaceSelect = document.getElementById("namespaceSelect");
  const serviceSelect = document.getElementById("serviceSelect");

  const trafficSlider = document.getElementById('traffic-slider');
  const trafficValue = document.getElementById('traffic-value');
  const unlockBtn = document.getElementById('unlock-btn');
  const deployToggle = document.getElementById('deploy-toggle');
  const deployTimeSelect = document.getElementById('deploy-time-select');

  const namespaceToServices = {
    default: ["nginx", "webapp", "api-server"],
    dev: ["dev-frontend", "dev-backend"],
    prod: ["prod-frontend", "prod-api", "prod-db"]
  };

  namespaceSelect.addEventListener("change", function () {
    const selectedNamespace = namespaceSelect.value;
    const services = namespaceToServices[selectedNamespace] || [];

    serviceSelect.innerHTML = '<option value="">서비스 선택</option>';

    services.forEach(service => {
      const option = document.createElement("option");
      option.value = service;
      option.textContent = service;
      serviceSelect.appendChild(option);
    });
  });

  // 슬라이더 값 표시
  trafficSlider.addEventListener('input', () => {
    trafficValue.textContent = `${trafficSlider.value}%`;
  });

  // 잠금 풀기 버튼 클릭 이벤트
  unlockBtn.addEventListener('click', () => {
    const isDisabled = trafficSlider.disabled;

    trafficSlider.disabled = !isDisabled;
    deployToggle.disabled = !isDisabled;
    deployTimeSelect.disabled = !isDisabled;

    unlockBtn.textContent = isDisabled ? '잠금 풀기' : '잠금 잠금';
  });

  // 배포 토글 on/off 이벤트
  deployToggle.addEventListener('change', () => {
    console.log(`배포 상태: ${deployToggle.checked ? 'ON' : 'OFF'}`);
  });

  // Deploy 버튼 클릭 이벤트
  document.getElementById('deploy-btn').addEventListener('click', () => {
    alert(`Deploy 클릭됨\n서비스: ${serviceSelect.value}\n트래픽: ${trafficSlider.value}%`);
  });

  // Rollback 버튼 클릭 이벤트
  document.getElementById('rollback-btn').addEventListener('click', () => {
    alert('Rollback 클릭됨');
  });

  // 초기 상태 : 잠금 상태라 슬라이더, 토글, 배포시간 비활성화
  trafficSlider.disabled = true;
  deployToggle.disabled = true;
  deployTimeSelect.disabled = true;
});
