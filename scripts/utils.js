export function makeBoxes(value, max) {
  const n = Number(value) || 0;
  return Array.from({ length: max }, (_, i) => i < n);
}
//dice
export const countSuccesses = (results) => {
  return results.filter(r => r.result <= 3).length;
};

export const countValue = (results, value) => {
  return results.filter(r => r.result === value).length;
};

export const sliceResultsIntoGroups = (results, groupSizes) => {
  let index = 0;
  return groupSizes.map(size => {
    const group = results.slice(index, index + size);
    index += size;
    return group;
  });
};

export const determineDominantPool = (pools) => {
  const poolScores = {};
  
  for (const [key, pool] of Object.entries(pools)) {
    poolScores[key] = {
      sixes: countValue(pool.results, 6),
      fives: countValue(pool.results, 5),
      fours: countValue(pool.results, 4),
      name: pool.name
    };
  }
  
  let dominantKey = 'discipline';
  let dominantScore = poolScores['discipline'];
  
  for (const [key, score] of Object.entries(poolScores)) {
    if (key === 'discipline') continue;
    
    if (score.sixes > dominantScore.sixes ||
        (score.sixes === dominantScore.sixes && score.fives > dominantScore.fives) ||
        (score.sixes === dominantScore.sixes && score.fives === dominantScore.fives && score.fours > dominantScore.fours)) {
      dominantKey = key;
      dominantScore = score;
    }
  }
  
  const allEqual = Object.values(poolScores).every(score => 
    score.sixes === dominantScore.sixes && 
    score.fives === dominantScore.fives && 
    score.fours === dominantScore.fours
  );
  
  return allEqual ? "Дисциплина" : poolScores[dominantKey].name;
};
//ui
export const getDiceStyles = () => {
  return {
    discipline: "width:40px;height:40px;border-radius:8px;background:rgba(200,200,200,0.8);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 4px 8px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);",
    madness: "width:40px;height:40px;border-radius:8px;background:rgba(220,50,50,0.8);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 4px 8px rgba(0,0,0,0.3);border:1px solid rgba(255,0,0,0.3);",
    exhaustion: "width:40px;height:40px;border-radius:8px;background:rgba(30,30,30,0.9);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:#e0e0e0;box-shadow:0 4px 8px rgba(0,0,0,0.5);border:1px solid rgba(0,0,0,0.5);"
  };
};

export const makeDieHtml = (result, style) => `
  <div style="${style}">
    ${result.result}
  </div>
`;

export const createRollMessageContent = (actorName, formula, diceHtml, totalSuccesses, dominantPool, disciplineCount, madnessCount, exhaustionCount) => {
  const successText = totalSuccesses === 1 ? 'успех' : 
                     totalSuccesses < 5 ? 'успеха' : 'успехов';
  
  return `
    <div style="background:linear-gradient(135deg,#1a1a1a 0%,#0d0d0d 100%);padding:15px;border-radius:10px;color:#e0e0e0;font-family:Inter,sans-serif;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <strong style="color:#ff4757;font-size:18px;">Бросок ${actorName}</strong>
        <span style="color:#4da6ff;font-family:monospace;">${formula}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:15px 0;">
        ${diceHtml}
      </div>
      <div style="text-align:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);">
        <strong style="color:#ff4757;font-size:20px;">${totalSuccesses} ${successText}</strong>
        <div style="margin-top:8px;color:#4da6ff;font-size:14px;">Доминирует: ${dominantPool}</div>
      </div>
      <div style="display:flex;justify-content:space-around;margin-top:10px;font-size:13px;color:#9e9e9e;">
        <span>Дисциплина: ${disciplineCount}</span>
        <span>Безумие: ${madnessCount}</span>
        <span>Истощение: ${exhaustionCount}</span>
      </div>
    </div>
  `;
};
//roll
export const handlePostRollUpdates = async (actor, madnessDice, exhaustionDice) => {
  const updates = {};
  
  if (madnessDice > 0) {
    updates["system.madness.value"] = Math.min(
      actor.system.madness.max, 
      actor.system.madness.value + 1
    );
  }
  
  if (exhaustionDice > 0) {
    updates["system.exhaustion.value"] = Math.min(
      actor.system.exhaustion.max, 
      actor.system.exhaustion.value + 1
    );
  }
  
  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
    return true;
  }
  
  return false;
};

//html

export function getAskReactionsCheckboxesHTML(points, hint){
    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 20px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);">
          <div style="margin-bottom: 15px; padding: 12px; background: rgba(30, 30, 30, 0.7); border-left: 3px solid #ff4757; border-radius: 0 8px 8px 0; font-style: italic; color: #a0a0a0; font-size: 14px; line-height: 1.5;">
            ${hint}
          </div>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="text-align: center; font-size: 18px; color: #ff4757; margin-bottom: 10px;">Выберите ровно ${points} реакции</div>

            <div style="background: rgba(25, 25, 25, 0.8); padding: 15px; border-radius: 10px; border: 1px solid #333;">
              <div style="font-weight: bold; color: #4da6ff; margin-bottom: 8px;">Бей</div>
              <div style="display: flex; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="hit" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="hit" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="hit" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
              </div>
            </div>

            <div style="background: rgba(25, 25, 25, 0.8); padding: 15px; border-radius: 10px; border: 1px solid #333;">
              <div style="font-weight: bold; color: #4da6ff; margin-bottom: 8px;">Беги</div>
              <div style="display: flex; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="flee" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="flee" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="flee" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
              </div>
            </div>

            <div id="err" style="color:#ff4757;font-weight:bold;text-align: center;padding:10px;background: rgba(40, 20, 20, 0.7);border-radius:8px;display:none;animation: pulse 0.5s;">
              Нужно выбрать ровно ${points} реакций!
            </div>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
          }
          .dryh-dialog .dialog-buttons button {
            background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
            border: 1px solid #444;
            color: #e0e0e0;
            padding: 8px 20px;
            border-radius: 8px;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          }
          .dryh-dialog .dialog-buttons button:hover {
            background: linear-gradient(135deg, #3a3a3a 0%, #252525 100%);
            border-color: #ff4757;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.7);
          }
          .dryh-dialog .dialog-buttons button:first-child {
            background: linear-gradient(135deg, #ff4757 0%, #c43131 100%);
            border-color: #ff4757;
          }
          .dryh-dialog .dialog-buttons button:first-child:hover {
            background: linear-gradient(135deg, #ff6b6b 0%, #e04040 100%);
            box-shadow: 0 6px 20px rgba(255, 71, 87, 0.4);
          }
        </style>
      `
}

export function getAskHTML(def, hint){
    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 20px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);">
          <div style="margin-bottom: 15px; padding: 12px; background: rgba(30, 30, 30, 0.7); border-left: 3px solid #ff4757; border-radius: 0 8px 8px 0; font-style: italic; color: #a0a0a0; font-size: 14px; line-height: 1.5;">
            ${hint}
          </div>
          <textarea id="dryh-input" style="width:100%;min-height:100px;padding:16px;border-radius:10px;border:1px solid #333;background: rgba(20, 20, 20, 0.8);color:#e0e0e0;font-size:15px;box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);transition: all 0.3s ease;border: 1px solid #444;resize: vertical;">${def ?? ""}</textarea>
        </div>
      `
}

//other
export function getAwakeStats(name, role, whatKeepsMeUp, whatJustHappened, appearance, whoIReallyAm, path, madness, exhaustion) {
    const steps = [
      { field: "name", title: "Твоё имя", hint: "Твоё имя", defaultValue: name },
      { field: "role", title: "Кто я", hint: "Кто ты (Профессия)", defaultValue: role },
      { field: "whatKeepsMeUp", title: "Что не дает мне уснуть?", hint: "Это источник бессонницы персонажа и показывает, какой была непосредственная история персонажа.", defaultValue: whatKeepsMeUp },
      { field: "whatJustHappened", title: "Что случилось только что?", hint: "Это то, что происходит с персонажем в его самой первой сцене игры", defaultValue: whatJustHappened },
      { field: "appearance", title: "Какой я снаружи?", hint: "Это определяет первое впечатление, которое производит персонаж, и говорит о том, что очевидно о нем. Подумайте о том, каким кажется главный герой на первый взгляд", defaultValue: appearance },
      { field: "whoIReallyAm", title: "Кто я на самом деле?", hint: "Это говорит о секретах главного героя, о той части его самого, которую он не показывает миру, если может этого избежать. Подумайте о том, каковы секреты главного героя?", defaultValue: whoIReallyAm },
      { field: "path", title: "Каков мой путь?", hint: "Этот вопрос касается целей персонажа и указывает на то, как в вакууме история о нем могла бы прийти к своему завершению.", defaultValue: path },
      { field: "madnessSkill", title: "Навык Безумия", hint: "Это некие сверхспособности персонажа.\nПример:\nНевидимость, чтение мыслей, невидимые помощники, прочие мистические навыки", defaultValue: madness },
      { field: "exhaustionSkill", title: "Навык Истощения", hint: "Это некий талант персонажа, который сверхъестественно лучше, чем у других людей.\nПример:\nБег, стрельба, игра на музыкальном инструменте прочие физические навыки", defaultValue: exhaustion },
      { field: "reactions", title: "Реакции", hint: "Распределите 3 очка между реакцией 'Бей' и 'Беги'. Вы будете использовать оставшиеся реакции в случае доминирования безумия", points: 3 }
    ];

    return steps
}