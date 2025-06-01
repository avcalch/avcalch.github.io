        let characters = JSON.parse(localStorage.getItem('characters')) || [];
        let editingCharId = null; 

        let currentSimState = []; 
        let showRoundMarkers = JSON.parse(localStorage.getItem('showRoundMarkers')) !== null ? JSON.parse(localStorage.getItem('showRoundMarkers')) : true;

        let roundEvents = JSON.parse(localStorage.getItem('roundEvents')) || [];

        const BUFF_DURATION_OPTIONS = [
            { value: 0, label: "지속 시간 없음 (영구)" }, 
            { value: 1, label: "1턴" },
            { value: 2, label: "2턴" },
            { value: 3, label: "3턴" },
            { value: 4, label: "4턴" },
            { value: 5, label: "5턴" }
        ];

        // --- 데이터 저장/불러오기 기능 ---

        // 데이터를 JSON 파일로 저장
        function saveDataAsFile() {
            const dataToSave = {
                characters: characters,
                roundEvents: roundEvents
            };
            const jsonString = JSON.stringify(dataToSave, null, 2); // 보기 좋게 들여쓰기 적용

            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `speed_calculator_data_${new Date().toISOString().slice(0, 10)}.json`; // 파일 이름 예시: speed_calculator_data_2025-06-01.json
            document.body.appendChild(a); // 파이어폭스 호환성 위해 필요
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('데이터 파일이 성공적으로 저장되었습니다.');
        }

        // JSON 파일에서 데이터를 불러오기
        function loadDataFromFile(event) {
            const file = event.target.files[0];
            if (!file) {
                document.getElementById('loadStatus').textContent = '파일을 선택하지 않았습니다.';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const loadedData = JSON.parse(e.target.result);

                    if (loadedData.characters && Array.isArray(loadedData.characters) &&
                        loadedData.roundEvents && Array.isArray(loadedData.roundEvents)) {
                        
                        characters = loadedData.characters;
                        roundEvents = loadedData.roundEvents;

                        localStorage.setItem('characters', JSON.stringify(characters));
                        localStorage.setItem('roundEvents', JSON.stringify(roundEvents));

                        renderCharacterList(); // 캐릭터 목록 업데이트
                        runSimulation();      // 시뮬레이션 다시 실행하여 불러온 데이터 적용
                        document.getElementById('loadStatus').textContent = '데이터를 성공적으로 불러왔습니다.';
                        alert('데이터를 성공적으로 불러왔습니다.');

                    } else {
                        throw new Error('올바른 데이터 형식이 아닙니다.');
                    }
                } catch (error) {
                    console.error('데이터 불러오기 오류:', error);
                    document.getElementById('loadStatus').textContent = `데이터 불러오기 실패: ${error.message}`;
                    alert(`데이터 불러오기 실패: ${error.message}\n(올바른 .json 파일인지 확인해주세요.)`);
                } finally {
                    // 파일 입력 필드 초기화 (동일 파일 재선택 가능하게)
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        }

        // --- 기존 시뮬레이션 및 UI 로직 ---

        function toggleRoundMarkers() {
            showRoundMarkers = !showRoundMarkers; 
            localStorage.setItem('showRoundMarkers', JSON.stringify(showRoundMarkers)); 
            updateRoundToggleButtonUI(); 
            runSimulation(); 
        }

        function updateRoundToggleButtonUI() {
            const button = document.getElementById('roundToggleButton');
            const text = document.getElementById('roundToggleText');
            if (showRoundMarkers) {
                text.textContent = '라운드 표시: ON';
                button.classList.remove('off');
                button.classList.add('on');
            } else {
                text.textContent = '라운드 표시: OFF';
                button.classList.remove('on');
                button.classList.add('off');
            }
        }

        function renderCharacterList() {
            const listDiv = document.getElementById('characterList');
            // 기존 h3와 버튼을 감싸는 div를 유지하고, 그 아래에 목록만 새로 추가
            const headerDiv = `
                <div class="character-list-header">
                    <h3>등록된 캐릭터</h3>
                    <button class="secondary" onclick="clearAllCharacters()">전체 초기화</button>
                </div>
            `;
            listDiv.innerHTML = headerDiv; // 헤더를 먼저 추가

            if (characters.length === 0) {
                listDiv.innerHTML += '<p>등록된 캐릭터가 없습니다.</p>';
                return;
            }
            characters.forEach(char => {
                const charItem = document.createElement('div');
                charItem.className = 'character-item';
                charItem.innerHTML = `
                    <span>이름: ${char.name}</span>
                    <span>기본 속도: ${char.baseSpeed}</span>
                    <span>현재 속도: ${char.initialCurrentSpeed}</span> 
                    <div>
                        <button class="primary" onclick="editCharacter('${char.id}')">수정</button>
                        <button class="secondary" onclick="deleteCharacter('${char.id}')">삭제</button>
                    </div>
                `;
                listDiv.appendChild(charItem);
            });
        }

        // 모든 캐릭터를 초기화하는 새로운 함수
        function clearAllCharacters() {
            if (confirm('모든 등록된 캐릭터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                characters = []; // 캐릭터 배열 비우기
                localStorage.setItem('characters', JSON.stringify(characters)); // 로컬 스토리지 업데이트
                roundEvents = []; // 라운드 이벤트도 함께 초기화 (데이터 무결성)
                localStorage.setItem('roundEvents', JSON.stringify(roundEvents));
                renderCharacterList(); // 캐릭터 목록 UI 업데이트
                clearCharacterForm(); // 입력 폼 초기화
                runSimulation(); // 시뮬레이션 결과 초기화 및 다시 실행
                alert('모든 캐릭터와 라운드 이벤트가 초기화되었습니다.');
            }
        }


        function addOrUpdateCharacter() {
            const name = document.getElementById('charName').value;
            const baseSpeed = parseInt(document.getElementById('baseSpeed').value);
            const initialCurrentSpeed = parseInt(document.getElementById('initialCurrentSpeed').value); 

            if (!name || isNaN(baseSpeed) || baseSpeed <= 0 || isNaN(initialCurrentSpeed) || initialCurrentSpeed <= 0) {
                alert('모든 필드를 올바르게 입력해주세요.');
                return;
            }

            if (editingCharId) {
                const charIndex = characters.findIndex(char => char.id === editingCharId);
                if (charIndex !== -1) {
                    characters[charIndex] = { 
                        ...characters[charIndex], 
                        name, 
                        baseSpeed: baseSpeed, 
                        initialCurrentSpeed: initialCurrentSpeed 
                    };
                }
                editingCharId = null;
                document.querySelector('button.primary').textContent = '캐릭터 추가';
            } else {
                const newChar = {
                    id: Date.now().toString(), 
                    name,
                    baseSpeed: baseSpeed, 
                    initialCurrentSpeed: initialCurrentSpeed, 
                    currentGauge: 0, 
                    buffs: [], 
                    eventsHistory: [] 
                };
                characters.push(newChar);
            }
            localStorage.setItem('characters', JSON.stringify(characters));
            renderCharacterList();
            runSimulation(); 
        }

        function editCharacter(id) {
            const char = characters.find(c => c.id === id);
            if (char) {
                document.getElementById('charName').value = char.name;
                document.getElementById('baseSpeed').value = char.baseSpeed;
                document.getElementById('initialCurrentSpeed').value = char.initialCurrentSpeed; 
                editingCharId = char.id;
                document.querySelector('button.primary').textContent = '캐릭터 수정';
            }
        }

        function deleteCharacter(id) {
            if (confirm('이 캐릭터를 삭제하시겠습니까?')) {
                characters = characters.filter(char => char.id !== id);
                localStorage.setItem('characters', JSON.stringify(characters));
                renderCharacterList();
                clearCharacterForm();
                runSimulation(); 
            }
        }

        function resetSimulationState() {
            if (confirm('모든 캐릭터의 시뮬레이션 상태 (게이지, 버프, 이벤트 이력)와 라운드 이벤트를 초기화하시겠습니까?')) {
                characters.forEach(char => {
                    char.currentGauge = 0;
                    char.buffs = [];
                    char.eventsHistory = [];
                });
                roundEvents = []; 
                localStorage.setItem('characters', JSON.stringify(characters));
                localStorage.setItem('roundEvents', JSON.stringify(roundEvents)); 
                runSimulation(); 
            }
        }

        function clearCharacterForm() {
            document.getElementById('charName').value = '';
            document.getElementById('baseSpeed').value = '100';
            document.getElementById('initialCurrentSpeed').value = '100'; 
            editingCharId = null;
            document.querySelector('button.primary').textContent = '캐릭터 추가';
        }

        function calculateAV(speed) {
            if (speed <= 0) return Infinity; 
            return 10000 / speed;
        }

        function getRound(av) {
            if (av >= 0 && av <= 150) {
                return 0;
            } else if (av > 150 && av <= 250) {
                return 1;
            } else if (av > 250 && av <= 350) {
                return 2;
            } else if (av > 350 && av <= 450) {
                return 3;
            } else if (av > 450 && av <= 550) {
                return 4;
            } else if (av > 550 && av <= 650) {
                return 5;
            }
            return Math.floor((av - 150.01) / 100) + 1; 
        }

        function runSimulation() {
            const outputDiv = document.getElementById('simulationOutput');
            outputDiv.innerHTML = ''; // 시뮬레이션 결과 초기화

            if (characters.length === 0) {
                outputDiv.innerHTML = '<p>시뮬레이션을 실행하려면 캐릭터를 추가해주세요.</p>';
                return;
            }

            // 모든 폼 닫기 (새 시뮬레이션 시작 전)
            document.querySelectorAll('.event-form').forEach(form => {
                form.classList.remove('active');
                // 폼이 라운드 마커 안에 있다면 부모에서 제거
                if (form.parentNode && form.parentNode.classList.contains('round-event-form-wrapper')) {
                    form.parentNode.remove();
                }
            });

            currentSimState = characters.map(char => {
                const initialSpeed = typeof char.initialCurrentSpeed === 'number' && !isNaN(char.initialCurrentSpeed) && char.initialCurrentSpeed > 0 
                                     ? char.initialCurrentSpeed 
                                     : (typeof char.baseSpeed === 'number' && !isNaN(char.baseSpeed) && char.baseSpeed > 0 ? char.baseSpeed : 100);

                const baseSpeed = typeof char.baseSpeed === 'number' && !isNaN(char.baseSpeed) && char.baseSpeed > 0 
                                  ? char.baseSpeed : 100;
                
                return {
                    id: char.id,
                    name: char.name,
                    baseSpeed: baseSpeed, 
                    initialCurrentSpeed: initialSpeed, 
                    currentSpeed: initialSpeed, 
                    currentGauge: 0, 
                    buffs: char.buffs ? JSON.parse(JSON.stringify(char.buffs)) : [], 
                    eventsHistory: char.eventsHistory ? JSON.parse(JSON.stringify(char.eventsHistory)) : [] 
                };
            });
            
            let currentGlobalAV = 0;
            let turnCount = 0;
            const MAX_TURNS = 50; 

            if (showRoundMarkers) {
                outputDiv.innerHTML += `
                    <div class="round-marker" id="round-marker-0">
                        <span class="marker-text">0 라운드 시작</span>
                        <button class="primary" onclick="showRoundEventForm(event, 0)">라운드 이벤트 추가</button>
                    </div>
                `;
            }
            let currentRound = 0;

            applyRoundEvents(0, outputDiv); // 0 라운드 이벤트 적용

            while (turnCount < MAX_TURNS) {
                turnCount++;

                updateAllCharactersCurrentSpeed(currentSimState); 

                let nextChar = null;
                let minTimeNeeded = Infinity; 
                currentSimState.forEach(char => {
                    if (char.currentSpeed <= 0) char.currentSpeed = 1; 

                    const remainingGauge = 10000 - char.currentGauge;
                    const actualRemainingGauge = Math.max(0, remainingGauge);
                    const timeNeeded = actualRemainingGauge / char.currentSpeed; 
                    
                    if (timeNeeded < minTimeNeeded) {
                        minTimeNeeded = timeNeeded;
                        nextChar = char;
                    } else if (timeNeeded === minTimeNeeded) { 
                        if (nextChar && char.currentSpeed > nextChar.currentSpeed) {
                            nextChar = char;
                        } else if (nextChar && char.currentSpeed === nextChar.currentSpeed) {
                            if (parseInt(char.id) < parseInt(nextChar.id)) { 
                                nextChar = char;
                            }
                        }
                    }
                });

                if (!nextChar || minTimeNeeded === Infinity || minTimeNeeded < 0) {
                    outputDiv.innerHTML += `<div class="simulation-event">더 이상 턴을 잡을 캐릭터가 없거나 시뮬레이션이 불안정합니다. (현재 AV: ${currentGlobalAV.toFixed(2)})</div>`;
                    break; 
                }

                currentGlobalAV += minTimeNeeded;

                const newRound = getRound(currentGlobalAV);
                if (newRound > currentRound) {
                    if (showRoundMarkers) {
                        outputDiv.innerHTML += `<div class="round-marker"><span class="marker-text">${currentRound} 라운드 끝</span></div>`; 
                        for (let r = currentRound + 1; r <= newRound; r++) {
                            outputDiv.innerHTML += `
                                <div class="round-marker" id="round-marker-${r}">
                                    <span class="marker-text">${r} 라운드 시작</span>
                                    <button class="primary" onclick="showRoundEventForm(event, ${r})">라운드 이벤트 추가</button>
                                </div>
                            `;
                            applyRoundEvents(r, outputDiv); 
                        }
                    }
                    currentRound = newRound;
                }

                currentSimState.forEach(char => {
                    if (char.id !== nextChar.id) { 
                        char.currentGauge += minTimeNeeded * char.currentSpeed; 
                        if (char.currentGauge > 10000) {
                            char.currentGauge = 10000; 
                        }
                    }
                });
                nextChar.currentGauge = 0; 

                const turnId = `turn-${nextChar.id}-${turnCount}`;
                outputDiv.innerHTML += `
                    <div class="simulation-event" id="sim-event-${turnId}">
                        <div class="character-turn">[${turnCount}] ${nextChar.name} (${nextChar.currentSpeed} 속도) ${currentGlobalAV.toFixed(2)}av</div>
                        <button class="primary" onclick="showTurnEventForm('form-${turnId}', '${nextChar.id}', ${currentGlobalAV.toFixed(2)}, ${turnCount})">이벤트 추가</button>
                        <div id="form-${turnId}" class="event-form">
                            <div class="form-group">
                                <label>대상:</label>
                                <select id="target-${turnId}">
                                    <option value="all">모든 캐릭터</option>
                                    ${currentSimState.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>이벤트 종류:</label>
                                <select id="eventType-${turnId}" onchange="toggleBuffDuration('form-${turnId}')">
                                    <option value="gauge">행동 게이지 증가 (%)</option>
                                    <option value="speed">속도 변동 (%, 고정 속도)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="value-${turnId}">값:</label>
                                <input type="text" id="value-${turnId}" placeholder="값 (예: 20, 10%)" required> 
                            </div>
                            <div class="form-group" id="buffDurationGroup-${turnId}" style="display:none;">
                                <label for="buffDuration-${turnId}">버프 지속 시간 (턴):</label>
                                <select id="buffDuration-${turnId}">
                                    ${BUFF_DURATION_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <input type="checkbox" id="isHold-${turnId}">
                                <label for="isHold-${turnId}">홀드 상태에서 발동</label>
                            </div>
                            <button class="primary" onclick="applyTurnEvent('${turnId}', '${nextChar.id}', ${currentGlobalAV.toFixed(2)}, ${turnCount})">적용</button>
                            <button class="secondary" onclick="document.getElementById('form-${turnId}').classList.remove('active');">닫기</button>
                        </div>
                    </div>
                `;

                currentSimState.forEach(simChar => {
                    simChar.eventsHistory.filter(e => e.turnNum === turnCount && e.actingCharId === nextChar.id && !e.isHold && e.eventType !== 'round').forEach(event => {
                        const eventDiv = document.getElementById(`sim-event-${turnId}`);
                        if (eventDiv) { 
                            const eventOutput = document.createElement('div');
                            eventOutput.innerHTML = event.description;
                            eventOutput.classList.add('event-detail');
                            eventDiv.appendChild(eventOutput);
                        }
                        
                        if (event.type === 'gauge') {
                            const gaugeToAdd = 10000 * (event.value / 100);
                            simChar.currentGauge = Math.min(10000, simChar.currentGauge + gaugeToAdd);
                        } 
                    });
                });
                
                currentSimState.forEach(char => {
                    char.buffs = char.buffs.map(buff => {
                        if (buff.appliedThisTurnId === turnId) { 
                            return { ...buff, appliedThisTurnId: null }; 
                        } else if (buff.duration > 0 && buff.turnsRemaining > 0) { 
                            buff.turnsRemaining--;
                        }
                        return buff;
                    }).filter(buff => buff.turnsRemaining > 0 || buff.duration === 0); 
                });
            }
            if (showRoundMarkers) {
                outputDiv.innerHTML += `<div class="round-marker"><span class="marker-text">${currentRound} 라운드 끝</span></div>`; 
            }
        }

        // 라운드 이벤트 폼 보이기/숨기기
        function showRoundEventForm(event, roundNum) {
            // 모든 .event-form 요소를 숨김 (active 클래스 제거)
            document.querySelectorAll('.event-form').forEach(form => {
                form.classList.remove('active');
                // 폼이 라운드 마커 안에 있다면 부모에서 제거
                if (form.parentNode && form.parentNode.classList.contains('round-event-form-wrapper')) {
                    form.parentNode.remove();
                }
            });

            // 클릭된 버튼의 부모 요소인 라운드 마커를 찾음
            const roundMarkerDiv = event.currentTarget.closest('.round-marker');
            if (!roundMarkerDiv) return;

            // roundEventFormContainer를 가져오거나 새로 생성
            let form = document.getElementById('roundEventFormContainer');
            if (!form) {
                form = document.createElement('div');
                form.id = 'roundEventFormContainer';
                form.classList.add('event-form');
                form.innerHTML = `
                    <h3>라운드 이벤트 추가</h3>
                    <input type="hidden" id="currentRoundForEvent">
                    <div class="form-group">
                        <label>대상:</label>
                        <select id="roundEventTarget">
                            </select>
                    </div>
                    <div class="form-group">
                        <label>이벤트 종류:</label>
                        <select id="roundEventType" onchange="toggleBuffDuration('roundEventFormContainer')">
                            <option value="gauge">행동 게이지 증가 (%)</option>
                            <option value="speed">속도 변동 (%, 고정 속도)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="roundEventValue">값:</label>
                        <input type="text" id="roundEventValue" placeholder="값 (예: 20, 10%)" required> 
                    </div>
                    <div class="form-group" id="buffDurationGroup-roundEventFormContainer" style="display:none;">
                        <label for="roundEventBuffDuration">버프 지속 시간 (턴):</label>
                        <select id="roundEventBuffDuration">
                            </select>
                    </div>
                    <button class="primary" onclick="applyRoundEvent()">적용</button>
                    <button class="secondary" onclick="document.getElementById('roundEventFormContainer').classList.remove('active');
                                                 if(document.getElementById('roundEventFormContainer').parentNode && document.getElementById('roundEventFormContainer').parentNode.classList.contains('round-event-form-wrapper')) {
                                                     document.getElementById('roundEventFormContainer').parentNode.remove();
                                                 }
                                                 ">닫기</button>
                `;
            }

            // 폼을 감쌀 div 생성 (CSS 조절 용이)
            let formWrapper = roundMarkerDiv.querySelector('.round-event-form-wrapper');
            if (!formWrapper) {
                formWrapper = document.createElement('div');
                formWrapper.classList.add('round-event-form-wrapper');
                roundMarkerDiv.appendChild(formWrapper);
            }
            formWrapper.appendChild(form); // 폼을 래퍼 안에 넣기

            form.classList.add('active'); // active 클래스 추가하여 display: block; 되도록
            document.getElementById('currentRoundForEvent').value = roundNum; 

            const targetSelect = document.getElementById('roundEventTarget');
            targetSelect.innerHTML = `<option value="all">모든 캐릭터</option>` +
                characters.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); 
            
            // 기본값 초기화
            document.getElementById('roundEventType').value = 'gauge';
            document.getElementById('roundEventValue').value = '';
            
            const buffDurationSelect = document.getElementById('roundEventBuffDuration');
            buffDurationSelect.innerHTML = BUFF_DURATION_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
            buffDurationSelect.value = '0'; // 기본값으로 첫 번째 옵션 선택

            toggleBuffDuration('roundEventFormContainer'); 
        }

        // 라운드 이벤트 적용
        function applyRoundEvent() {
            const roundNum = parseInt(document.getElementById('currentRoundForEvent').value);
            const targetId = document.getElementById('roundEventTarget').value;
            const eventType = document.getElementById('roundEventType').value;
            let valueInput = document.getElementById('roundEventValue').value;
            const buffDuration = parseInt(document.getElementById('roundEventBuffDuration').value);

            let value;
            let valueType;

            if (valueInput.endsWith('%')) {
                valueType = '%';
                value = parseFloat(valueInput.slice(0, -1));
            } else {
                valueType = 'fixed';
                value = parseFloat(valueInput);
            }

            if (isNaN(value)) {
                alert('값을 올바르게 입력해주세요 (예: 20 또는 10%).');
                return;
            }

            let roundEntry = roundEvents.find(entry => entry.round === roundNum);
            if (!roundEntry) {
                roundEntry = { round: roundNum, events: [] };
                roundEvents.push(roundEntry);
            }

            const targets = targetId === 'all' ? characters : characters.filter(c => c.id === targetId);

            targets.forEach(targetChar => {
                let eventDescription = ``;
                let eventData = {
                    type: eventType,
                    value: value,
                    targetId: targetChar.id,
                    eventType: 'round', 
                };

                if (eventType === 'gauge') {
                    eventDescription = `라운드 ${roundNum} 시작: ${targetChar.name}에게 행동 게이지 ${value}% 증가`;
                } else if (eventType === 'speed') {
                    eventData.valueType = valueType;
                    eventData.duration = buffDuration;
                    eventData.turnsRemaining = buffDuration;
                    eventDescription = `라운드 ${roundNum} 시작: ${targetChar.name}에게 속도 ${value}${valueType} 변동 (${buffDuration > 0 ? buffDuration + '턴 지속' : '영구'})`;
                }
                eventData.description = eventDescription;
                roundEntry.events.push(eventData);
            });

            localStorage.setItem('roundEvents', JSON.stringify(roundEvents));
            // 폼 숨기고 부모 래퍼 제거
            const form = document.getElementById('roundEventFormContainer');
            if (form) {
                form.classList.remove('active');
                if (form.parentNode && form.parentNode.classList.contains('round-event-form-wrapper')) {
                    form.parentNode.remove();
                }
            }
            runSimulation(); 
        }

        function applyRoundEvents(currentRound, outputDiv) {
            const roundEntry = roundEvents.find(entry => entry.round === currentRound);
            if (roundEntry && roundEntry.events.length > 0) {
                outputDiv.innerHTML += `<div class="event-detail" style="background-color: #ffe0b2; border: 1px solid #ffcc80;">라운드 ${currentRound} 시작 이벤트:</div>`;
                roundEntry.events.forEach(event => {
                    const eventOutput = document.createElement('div');
                    eventOutput.innerHTML = event.description;
                    eventOutput.classList.add('event-detail');
                    eventOutput.style.backgroundColor = '#fff3e0'; 
                    eventOutput.style.borderColor = '#ffcc80'; 

                    outputDiv.appendChild(eventOutput);

                    const targetSimChars = event.targetId === 'all' ? currentSimState : currentSimState.filter(c => c.id === event.targetId);
                    targetSimChars.forEach(simChar => {
                        if (event.type === 'gauge') {
                            const gaugeToAdd = 10000 * (event.value / 100);
                            simChar.currentGauge = Math.min(10000, simChar.currentGauge + gaugeToAdd);
                        } else if (event.type === 'speed') {
                            simChar.buffs = simChar.buffs || [];
                            simChar.buffs = simChar.buffs.filter(b => !(b.type === 'speed' && b.valueType === event.valueType));
                            simChar.buffs.push({
                                type: 'speed',
                                value: event.value,
                                valueType: event.valueType,
                                duration: event.duration,
                                turnsRemaining: event.turnsRemaining,
                                appliedAtAv: 0, 
                                appliedThisTurnId: null 
                            });
                        }
                    });
                });
            }
        }

        function updateAllCharactersCurrentSpeed(simChars) {
            simChars.forEach(char => {
                let percentBuffSum = 0; 
                let fixedBuffSum = 0; 

                char.buffs.forEach(buff => {
                    if (buff.type === 'speed') {
                        if (buff.valueType === '%') {
                            percentBuffSum += (buff.value / 100); 
                        } else if (buff.valueType === 'fixed') {
                            fixedBuffSum += buff.value;
                        }
                    }
                });

                let calculatedSpeed = char.initialCurrentSpeed + (char.baseSpeed * percentBuffSum) + fixedBuffSum;
                
                char.currentSpeed = Math.max(1, Math.round(calculatedSpeed)); 
            });
        }

        function showTurnEventForm(formId, charId, currentAv, turnNum) { 
            // 모든 .event-form 요소를 숨김 (active 클래스 제거)
            document.querySelectorAll('.event-form').forEach(form => {
                form.classList.remove('active');
                // 라운드 이벤트 폼이 라운드 마커 안에 있다면 부모에서 제거
                if (form.parentNode && form.parentNode.classList.contains('round-event-form-wrapper')) {
                    form.parentNode.remove();
                }
            });

            const form = document.getElementById(formId);
            if (form) {
                form.classList.add('active'); 

                const targetSelect = document.getElementById(`target-${formId.replace('form-','')}`);
                targetSelect.innerHTML = `<option value="all">모든 캐릭터</option>` +
                    currentSimState.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                targetSelect.value = charId; 

                // 기본값 초기화
                document.getElementById(`eventType-${formId.replace('form-','')}`).value = 'gauge';
                document.getElementById(`value-${formId.replace('form-','')}`).value = '';
                const buffDurationSelect = document.getElementById(`buffDuration-${formId.replace('form-','')}`);
                buffDurationSelect.innerHTML = BUFF_DURATION_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
                buffDurationSelect.value = '0';
                document.getElementById(`isHold-${formId.replace('form-','')}`).checked = false;


                toggleBuffDuration(formId);
            }
        }

        function toggleBuffDuration(formId) {
            const formElement = document.getElementById(formId);
            if (!formElement) return;

            const eventTypeSelect = formElement.querySelector('[id^="eventType-"]');
            const buffDurationGroup = formElement.querySelector('[id^="buffDurationGroup-"]');
            
            if (!eventTypeSelect || !buffDurationGroup) return; 

            if (eventTypeSelect.value === 'speed') {
                buffDurationGroup.style.display = 'block';
            } else {
                buffDurationGroup.style.display = 'none';
            }
        }

        function applyTurnEvent(turnId, actingCharId, currentAv, turnNum) { 
            const targetId = document.getElementById(`target-${turnId}`).value;
            const eventType = document.getElementById(`eventType-${turnId}`).value;
            let valueInput = document.getElementById(`value-${turnId}`).value; 
            const isHold = document.getElementById(`isHold-${turnId}`).checked;
            const buffDuration = parseInt(document.getElementById(`buffDuration-${turnId}`).value);

            let value;
            let valueType; 

            if (valueInput.endsWith('%')) {
                valueType = '%';
                value = parseFloat(valueInput.slice(0, -1)); 
            } else {
                valueType = 'fixed';
                value = parseFloat(valueInput); 
            }

            if (isNaN(value)) {
                alert('값을 올바르게 입력해주세요 (예: 20 또는 10%).');
                return;
            }

            const actingCharOriginal = characters.find(c => c.id === actingCharId);
            if (!actingCharOriginal) return;

            const targetsOriginal = targetId === 'all' ? characters : characters.filter(c => c.id === targetId);

            targetsOriginal.forEach(targetCharOriginal => {
                let eventDescription = ``; 

                let eventData = {
                    turnNum: turnNum, 
                    actingCharId: actingCharId, 
                    type: eventType,
                    value: value,
                    targetId: targetCharOriginal.id, 
                    isHold: isHold,
                    appliedAtAv: currentAv,
                    turnId: turnId,
                    eventType: 'turn' 
                };

                if (eventType === 'gauge') {
                    eventDescription = `
                        ${actingCharOriginal.name}이(가) ${targetCharOriginal.name}에게 행동 게이지 ${value}% 증가 
                        (AV: ${currentAv.toFixed(2)}, ${isHold ? '홀드 발동' : '턴 종료 후 발동'})
                    `;
                } else if (eventType === 'speed') {
                    eventData.valueType = valueType;
                    eventData.duration = buffDuration;
                    eventData.turnsRemaining = buffDuration; 

                    eventDescription = `
                        ${actingCharOriginal.name}이(가) ${targetCharOriginal.name}에게 속도 ${value}${valueType} 변동 
                        (${buffDuration > 0 ? buffDuration + '턴 지속' : '영구'}, AV: ${currentAv.toFixed(2)}, ${isHold ? '홀드 발동' : '턴 종료 후 발동'})
                    `;
                    
                    targetCharOriginal.buffs = targetCharOriginal.buffs || [];
                    targetCharOriginal.buffs = targetCharOriginal.buffs.filter(b => !(b.type === 'speed' && b.valueType === eventData.valueType));
                    targetCharOriginal.buffs.push({
                        type: 'speed',
                        value: eventData.value,
                        valueType: eventData.valueType,
                        duration: eventData.duration,
                        turnsRemaining: eventData.turnsRemaining,
                        appliedAtAv: eventData.appliedAtAv,
                        appliedThisTurnId: isHold ? turnId : null 
                    });
                }
                eventData.description = eventDescription; 
                targetCharOriginal.eventsHistory = targetCharOriginal.eventsHistory || []; 
                targetCharOriginal.eventsHistory.push(eventData);
            });

            localStorage.setItem('characters', JSON.stringify(characters));

            document.getElementById(`form-${turnId}`).classList.remove('active');
            runSimulation();
        }

        window.onload = () => {
            renderCharacterList();
            updateRoundToggleButtonUI(); 
            runSimulation();
        };