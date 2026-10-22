/**
 * CAREER COMPASS - フロントエンド・アプリケーション制御ロジック
 * 統括PM: アキ (Aki)
 * 
 * 5問クイック診断 ＆ 30問精密深層心理診断 ＆ LINE誘導・4桁暗号コード連携
 */

(function () {
    let allQuestions = [];
    let currentQuestionIndex = 0;
    let answers = {}; // { questionId: score (1~5) }
    let quickResultData = null;
    let fullResultData = null;
    let radarChartInstance = null;
    let typesData = null;
    let currentCatalogTab = 'deep';
    let currentSelectedType = null;

    // 8パターンの4桁暗号コードマッピング（LINE応答メッセージ連動）
    const typeCodeMap = {
        visionary_pioneer: '1001',
        deep_craftsperson: '2002',
        empathetic_facilitator: '3003',
        pragmatic_achiever: '4004',
        sustainable_lifebuilder: '5005',
        passionate_storyteller: '6006',
        inspiring_orchestrator: '7007',
        agile_freeroamer: '8008'
    };

    const codeTypeMap = {
        '1001': 'visionary_pioneer',
        '2002': 'deep_craftsperson',
        '3003': 'empathetic_facilitator',
        '4004': 'pragmatic_achiever',
        '5005': 'sustainable_lifebuilder',
        '6006': 'passionate_storyteller',
        '7007': 'inspiring_orchestrator',
        '8008': 'agile_freeroamer'
    };

    const axisLabels = {
        autonomy: '働き方の裁量・自律ペース',
        innovation: '挑戦・革新・スピード変化',
        people: '共感・対人関係・チーム貢献',
        growth: '成果・市場価値・キャリア成長',
        purpose: '社会的意義・やりがい・ビジョン'
    };

    const app = {
        // 初期化
        async init() {
            try {
                // 1. タイプデータをロード（静的データ優先、なければAPI）
                await this.loadTypesData();

                // 2. 設問データをロード（静的データ優先、なければAPI）
                if (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.questions) {
                    allQuestions = window.CAREER_COMPASS_DATA.questions;
                    console.log(`[CAREER COMPASS Static] ${allQuestions.length}問の静的設問データを即座に読み込みました。`);
                } else {
                    const res = await fetch('/api/questions');
                    if (!res.ok) throw new Error('質問データの取得に失敗しました');
                    const data = await res.json();
                    allQuestions = data.questions || [];
                    console.log(`[CAREER COMPASS API] ${allQuestions.length}問の設問データを正常に読み込みました。`);
                }

                // URLパラメータによる直接診断結果表示ルーティングチェック（LINEからの流入対応）
                this.checkUrlRouting();
            } catch (err) {
                console.warn('[CAREER COMPASS Init Notice]', err);
                // 静的データフォールバックの最終確認
                if (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.questions) {
                    allQuestions = window.CAREER_COMPASS_DATA.questions;
                    typesData = window.CAREER_COMPASS_DATA.results;
                    this.checkUrlRouting();
                } else {
                    alert('データの初期化に失敗しました。ページを再読み込みしてください。');
                }
            }
        },

        // URLパラメータによる直接表示ルーティング（?code=1001 または ?type=visionary_pioneer）
        checkUrlRouting() {
            try {
                const params = new URLSearchParams(window.location.search);
                const codeParam = params.get('code');
                const typeParam = params.get('type') || params.get('result');

                let targetTypeId = null;
                if (codeParam && codeTypeMap[codeParam]) {
                    targetTypeId = codeTypeMap[codeParam];
                } else if (typeParam) {
                    targetTypeId = typeParam;
                }

                if (targetTypeId) {
                    console.log(`[CAREER COMPASS Routing] URLパラメータ検知: target=${targetTypeId}`);
                    this.renderDirectResult(targetTypeId);
                }
            } catch (e) {
                console.warn('[Routing Error]', e);
            }
        },

        // タイプデータの非同期ロード（静的データ優先フォールバック）
        async loadTypesData() {
            if (typesData) return typesData;
            if (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.results) {
                typesData = window.CAREER_COMPASS_DATA.results;
                console.log('[CAREER COMPASS Static] 全診断タイプデータを静的メモリから即時ロードしました。');
                return typesData;
            }
            try {
                const res = await fetch('/api/types');
                if (!res.ok) throw new Error('診断タイプデータの取得に失敗しました');
                typesData = await res.json();
                console.log('[CAREER COMPASS API] 全診断タイプデータを正常にロードしました。');
                return typesData;
            } catch (err) {
                console.warn('[CAREER COMPASS Types Notice]', err);
                if (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.results) {
                    typesData = window.CAREER_COMPASS_DATA.results;
                    return typesData;
                }
                return null;
            }
        },

        // 診断開始（クイック: 第1問から / 精密: 第1問または第6問から）
        startDiagnosis(mode = 'quick') {
            if (allQuestions.length === 0) {
                alert('設問データを読み込み中です。少々お待ちください。');
                return;
            }

            // 画面の切り替え
            this.hideAllViews();
            const viewQuestion = document.getElementById('view-question');
            if (viewQuestion) viewQuestion.classList.remove('hidden');

            currentQuestionIndex = 0;
            this.renderQuestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // 全ビュー非表示ヘルパー
        hideAllViews() {
            ['view-hero', 'view-question', 'view-quick-result', 'view-full-result', 'view-catalog', 'view-line-gate'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
        },

        // ホーム（トップ）に戻る
        resetToHome() {
            this.hideAllViews();
            const viewHero = document.getElementById('view-hero');
            if (viewHero) viewHero.classList.remove('hidden');

            // 成功メッセージも隠してフォーム再表示
            const successMsg = document.getElementById('lead-success-msg');
            const form = document.getElementById('consultation-form');
            if (successMsg) successMsg.classList.add('hidden');
            if (form) form.classList.remove('hidden');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // 設問の描画
        renderQuestion() {
            const q = allQuestions[currentQuestionIndex];
            if (!q) return;

            const isDeepMode = currentQuestionIndex >= 5;
            const currentNum = currentQuestionIndex + 1;
            const totalNum = isDeepMode ? 30 : 5;
            const progressPercent = Math.min(100, Math.round((currentNum / totalNum) * 100));

            // ステージバッジ
            const stageBadge = document.getElementById('question-stage-badge');
            if (stageBadge) {
                stageBadge.textContent = isDeepMode ? '精密深層心理診断（計30問）' : 'クイック診断（全5問）';
                stageBadge.className = isDeepMode
                    ? 'font-bold text-indigo-400 uppercase tracking-wider'
                    : 'font-bold text-teal-400 uppercase tracking-wider';
            }

            // 進捗テキスト & バー
            const progressText = document.getElementById('question-progress-text');
            if (progressText) {
                progressText.textContent = `第 ${currentNum} 問 / 全 ${totalNum} 問`;
            }
            const barFill = document.getElementById('progress-bar-fill');
            if (barFill) {
                barFill.style.width = `${progressPercent}%`;
            }

            // 設問番号 & 軸ラベル
            const numBadge = document.getElementById('question-number-badge');
            if (numBadge) numBadge.textContent = `Q${q.id}`;

            const axisLabel = document.getElementById('question-axis-label');
            if (axisLabel) axisLabel.textContent = axisLabels[q.axis] || '適性項目';

            // 質問文 & ヒント
            const questionText = document.getElementById('question-text');
            if (questionText) questionText.textContent = q.question;

            const hintText = document.getElementById('question-hint-text');
            if (hintText) hintText.textContent = q.hint || '直感でお答えください';

            // 戻るボタンの活性化/非活性化
            const btnPrev = document.getElementById('btn-prev-question');
            if (btnPrev) {
                btnPrev.disabled = (currentQuestionIndex === 0);
            }

            // 5段階選択肢のレンダリング
            const container = document.getElementById('options-container');
            if (container) {
                container.innerHTML = '';
                const selectedScore = answers[q.id];

                q.options.forEach((opt, idx) => {
                    const isSelected = selectedScore === opt.score;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                        isSelected
                            ? 'bg-gradient-to-r from-teal-500/20 to-indigo-600/30 border-teal-400 text-white shadow-lg shadow-teal-500/20 scale-[1.01]'
                            : 'bg-slate-800/70 hover:bg-slate-800/90 border-slate-700/80 hover:border-teal-400/50 text-slate-200'
                    }`;

                    btn.onclick = () => this.selectOption(opt.score);

                    btn.innerHTML = `
                        <div class="flex items-center space-x-3">
                            <span class="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                                isSelected
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-slate-700 group-hover:bg-teal-500/30 text-slate-300'
                            }">${idx + 1}</span>
                            <span class="text-xs sm:text-sm font-semibold">${opt.label}</span>
                        </div>
                        <div class="w-4 h-4 rounded-full border ${
                            isSelected ? 'border-teal-400 bg-teal-400' : 'border-slate-600'
                        } flex items-center justify-center">
                            ${isSelected ? '<svg class="w-2.5 h-2.5 text-slate-900 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>' : ''}
                        </div>
                    `;
                    container.appendChild(btn);
                });
            }
        },

        // 選択肢を選択したときの処理
        async selectOption(score) {
            const q = allQuestions[currentQuestionIndex];
            if (!q) return;

            answers[q.id] = score;

            // 即座に再描画して選択フィードバック
            this.renderQuestion();

            // わずかなディレイ後に次のステップへ
            setTimeout(async () => {
                // 第5問完了時（インデックス4）
                if (currentQuestionIndex === 4) {
                    await this.finishQuickDiagnosis();
                    return;
                }

                // 第30問完了時（インデックス29）
                if (currentQuestionIndex === 29) {
                    await this.finishFullDiagnosis();
                    return;
                }

                // 次の問へ進む
                currentQuestionIndex++;
                this.renderQuestion();
            }, 220);
        },

        // 前の設問に戻る
        prevQuestion() {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                this.renderQuestion();
            }
        },

        // クライアントサイドでのクイック診断判定（サーバーレス対応）
        calculateQuickType(userAnswers) {
            const types = (typesData && typesData.quick_types) || (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.results && window.CAREER_COMPASS_DATA.results.quick_types) || {};
            const s_autonomy = userAnswers[1] || 3;
            const s_innovation = userAnswers[2] || 3;
            const s_people = userAnswers[3] || 3;
            const s_growth = userAnswers[4] || 3;
            const s_purpose = userAnswers[5] || 3;

            const scores = {
                pioneer: (s_autonomy * 1.3) + (s_innovation * 1.5),
                expert: (s_autonomy * 1.2) + (6 - s_people) * 0.8 + (s_purpose * 0.9),
                harmonizer: (s_people * 1.6) + (s_purpose * 1.2) + (6 - s_growth) * 0.6,
                strategist: (s_growth * 1.6) + (s_innovation * 1.0) + (s_autonomy * 0.8)
            };

            let bestType = 'pioneer';
            let maxScore = -Infinity;
            for (const [t, s] of Object.entries(scores)) {
                if (s > maxScore) {
                    maxScore = s;
                    bestType = t;
                }
            }
            return {
                type_id: bestType,
                result: types[bestType] || types['pioneer'] || { name: '未来開拓イノベーター', badge: '挑戦 × 自律' },
                scores: scores
            };
        },

        // クライアントサイドでの精密30問診断判定（サーバーレス対応）
        calculateFullType(userAnswers) {
            const types = (typesData && typesData.deep_types) || (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.results && window.CAREER_COMPASS_DATA.results.deep_types) || {};
            const questions = allQuestions.length > 0 ? allQuestions : (window.CAREER_COMPASS_DATA && window.CAREER_COMPASS_DATA.questions) || [];

            const axis_scores = { autonomy: 0, innovation: 0, people: 0, growth: 0, purpose: 0 };
            const axis_counts = { autonomy: 0, innovation: 0, people: 0, growth: 0, purpose: 0 };

            questions.forEach(q => {
                const qid = q.id;
                const axis = q.axis;
                const score = userAnswers[qid] || 3;
                if (axis_scores[axis] !== undefined) {
                    axis_scores[axis] += score;
                    axis_counts[axis] += 1;
                }
            });

            const axis_percent = {};
            for (const axis of Object.keys(axis_scores)) {
                const total = axis_scores[axis];
                const count = axis_counts[axis] || 6;
                const max_possible = count * 5;
                const min_possible = count * 1;
                const pct = max_possible > min_possible
                    ? Math.round(((total - min_possible) / (max_possible - min_possible)) * 100)
                    : 50;
                axis_percent[axis] = Math.max(0, Math.min(100, pct));
            }

            // 8大深層心理タイプの多角心理プロファイル基準値（0-100%基準）
            const targetProfiles = {
                visionary_pioneer:      { autonomy: 90, innovation: 90, people: 50, growth: 80, purpose: 60 },
                deep_craftsperson:      { autonomy: 85, innovation: 55, people: 35, growth: 85, purpose: 55 },
                empathetic_facilitator: { autonomy: 55, innovation: 45, people: 95, growth: 40, purpose: 85 },
                pragmatic_achiever:     { autonomy: 80, innovation: 75, people: 45, growth: 95, purpose: 45 },
                sustainable_lifebuilder:{ autonomy: 70, innovation: 35, people: 75, growth: 35, purpose: 80 },
                passionate_storyteller: { autonomy: 75, innovation: 85, people: 65, growth: 55, purpose: 95 },
                inspiring_orchestrator: { autonomy: 70, innovation: 80, people: 85, growth: 85, purpose: 65 },
                agile_freeroamer:       { autonomy: 90, innovation: 80, people: 65, growth: 55, purpose: 75 }
            };

            const axes = ['autonomy', 'innovation', 'people', 'growth', 'purpose'];
            const uVals = axes.map(a => axis_percent[a] || 50);
            const uMean = uVals.reduce((sum, v) => sum + v, 0) / axes.length;
            const uDev = uVals.map(v => v - uMean);
            const uNorm = Math.sqrt(uDev.reduce((sum, d) => sum + d * d, 0));

            let bestType = 'visionary_pioneer';
            let maxMatchScore = -Infinity;

            for (const [t, target] of Object.entries(targetProfiles)) {
                const tVals = axes.map(a => target[a]);
                const tMean = tVals.reduce((sum, v) => sum + v, 0) / axes.length;
                const tDev = tVals.map(v => v - tMean);
                const tNorm = Math.sqrt(tDev.reduce((sum, d) => sum + d * d, 0));

                let corrScore = 0.5;
                if (uNorm > 0 && tNorm > 0) {
                    const dot = uDev.reduce((sum, d, i) => sum + d * tDev[i], 0);
                    const corr = dot / (uNorm * tNorm);
                    corrScore = (corr + 1.0) / 2.0;
                }

                const dist = Math.sqrt(uVals.reduce((sum, v, i) => sum + Math.pow(v - tVals[i], 2), 0));
                const distScore = Math.max(0.0, 1.0 - (dist / 160.0));

                // 総合適合度 (波形相関 65% + 近傍距離 35%)
                const matchScore = (corrScore * 0.65) + (distScore * 0.35);

                if (matchScore > maxMatchScore) {
                    maxMatchScore = matchScore;
                    bestType = t;
                }
            }

            const result = types[bestType] || types['visionary_pioneer'] || { name: '常識を覆す未来開拓者', code: '1001' };
            const code = result.code || typeCodeMap[bestType] || '1001';

            return {
                type_id: bestType,
                code: code,
                result: result,
                axis_scores: axis_scores,
                axis_percent: axis_percent
            };
        },

        // 5問クイック診断の完了処理（自律ハイブリッド）
        async finishQuickDiagnosis() {
            // 1. クライアントサイドで即時高精度計算（サーバーレス・オフライン完全対応）
            quickResultData = this.calculateQuickType(answers);
            this.renderQuickResult(quickResultData);

            // 2. バックエンドAPIが存在する場合は非同期バックグラウンド同期（静的ホスティングで404になってもUIは無影響）
            try {
                fetch('/api/diagnose/quick', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers })
                }).catch(() => {});
            } catch (_) {}
        },

        // クライアントサイドでの精密30問診断判定
        renderQuickResult(data) {
            this.hideAllViews();
            const viewQuick = document.getElementById('view-quick-result');
            if (viewQuick) viewQuick.classList.remove('hidden');

            const res = data.result || {};
            const qBadge = document.getElementById('quick-badge');
            if (qBadge) qBadge.textContent = res.badge || '適性タイプ速報';

            const qTitle = document.getElementById('quick-title');
            if (qTitle) qTitle.textContent = res.name || '判定中';

            const qTagline = document.getElementById('quick-tagline');
            if (qTagline) qTagline.textContent = res.tagline || '';

            const qSummary = document.getElementById('quick-summary');
            if (qSummary) qSummary.textContent = res.summary || '';

            const qDirection = document.getElementById('quick-direction');
            if (qDirection) qDirection.textContent = res.recommended_direction || '';

            const qPreview = document.getElementById('quick-preview');
            if (qPreview) qPreview.textContent = res.deep_preview || '';

            // 相談フォームに診断結果をセット
            const formDiagType = document.getElementById('form-diagnosis-type');
            if (formDiagType) formDiagType.value = `[クイック] ${res.name}`;

            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // クイック結果からさらに25問（計30問）の精密診断へ継続
        continueToFullDiagnosis() {
            this.hideAllViews();
            const viewQuestion = document.getElementById('view-question');
            if (viewQuestion) viewQuestion.classList.remove('hidden');

            currentQuestionIndex = 5; // 第6問から再開
            this.renderQuestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // 30問精密診断の完了処理（自律ハイブリッド）
        async finishFullDiagnosis() {
            // 1. クライアントサイドで即時高精度計算（サーバーレス・オフライン完全対応）
            fullResultData = this.calculateFullType(answers);
            // 30問回答直後は診断結果を直接表示せず、公式LINE誘導＆4桁暗号コード画面へ遷移
            this.renderLineGate(fullResultData);

            // 2. バックエンドAPIが存在する場合は非同期バックグラウンド同期（静的ホスティングで404になってもUIは無影響）
            try {
                fetch('/api/diagnose/full', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers })
                }).catch(() => {});
            } catch (_) {}
        },

        // LINE誘導 ＆ 4桁暗号コード表示画面（VIEW 6）
        renderLineGate(data) {
            this.hideAllViews();
            const viewGate = document.getElementById('view-line-gate');
            if (viewGate) viewGate.classList.remove('hidden');

            const code = data.code || (data.result && data.result.code) || (typeCodeMap[data.type_id] || '1001');
            const codeEl = document.getElementById('line-gate-code');
            if (codeEl) codeEl.textContent = code;

            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // β版限定: 診断結果直接確認処理（本番LINE連携完了まではワンタップで結果画面へ遷移）
        viewFullResultDirectly() {
            if (fullResultData) {
                this.renderFullResult(fullResultData);
            } else {
                // フォールバック: 現在の回答状態から再計算
                fullResultData = this.calculateFullType(answers);
                this.renderFullResult(fullResultData);
            }
        },

        // 4桁暗号コードのクリップボードコピー（本番運用時使用）
        copyGateCode() {
            const codeEl = document.getElementById('line-gate-code');
            const code = codeEl ? codeEl.textContent.trim() : '';
            if (!code) return;

            navigator.clipboard.writeText(code).then(() => {
                const badge = document.getElementById('copy-badge');
                if (badge) {
                    badge.classList.remove('opacity-0');
                    setTimeout(() => {
                        badge.classList.add('opacity-0');
                    }, 2500);
                }
            }).catch(err => {
                console.warn('[Clipboard Error]', err);
                prompt('以下の4桁コードをコピーしてください:', code);
            });
        },

        // LINE無料キャリア相談モーダル開閉
        openLineModal() {
            const modal = document.getElementById('line-consultation-modal');
            if (modal) modal.classList.remove('hidden');
        },

        closeLineModal() {
            const modal = document.getElementById('line-consultation-modal');
            if (modal) modal.classList.add('hidden');
        },

        // URLパラメータからの直接診断結果描画（LINEボット応答リンク対応）
        async renderDirectResult(typeId) {
            const types = await this.loadTypesData();
            if (!types || !types.deep_types) return;

            const target = types.deep_types[typeId];
            if (!target) return;

            const defaultAxisScores = {
                visionary_pioneer: { autonomy: 95, innovation: 95, people: 55, growth: 85, purpose: 75 },
                deep_craftsperson: { autonomy: 90, innovation: 70, people: 40, growth: 85, purpose: 60 },
                empathetic_facilitator: { autonomy: 60, innovation: 50, people: 95, growth: 65, purpose: 90 },
                pragmatic_achiever: { autonomy: 75, innovation: 80, people: 55, growth: 95, purpose: 60 },
                sustainable_lifebuilder: { autonomy: 85, innovation: 45, people: 75, growth: 50, purpose: 80 },
                passionate_storyteller: { autonomy: 80, innovation: 90, people: 70, growth: 75, purpose: 85 },
                inspiring_orchestrator: { autonomy: 75, innovation: 85, people: 90, growth: 85, purpose: 85 },
                agile_freeroamer: { autonomy: 95, innovation: 85, people: 65, growth: 70, purpose: 65 }
            };

            const pct = defaultAxisScores[typeId] || { autonomy: 70, innovation: 70, people: 70, growth: 70, purpose: 70 };
            fullResultData = { result: target, axis_percent: pct };

            this.renderFullResult(fullResultData);
        },

        // 30問精密結果画面の表示
        renderFullResult(data) {
            this.hideAllViews();
            const viewFull = document.getElementById('view-full-result');
            if (viewFull) viewFull.classList.remove('hidden');

            const res = data.result || {};
            const pct = data.axis_percent || {};

            // ヘッダー情報
            const fBadge = document.getElementById('full-badge');
            if (fBadge) fBadge.textContent = res.id ? res.id.replace(/_/g, ' ').toUpperCase() : 'DEEP PROFILE';

            const fName = document.getElementById('full-name');
            if (fName) fName.textContent = res.name || '深層心理プロファイル';

            const fCatchphrase = document.getElementById('full-catchphrase');
            if (fCatchphrase) fCatchphrase.textContent = res.catchphrase || '';

            // 5軸スコア数値＆プログレスバー
            const axes = ['autonomy', 'innovation', 'people', 'growth', 'purpose'];
            axes.forEach(axis => {
                const val = pct[axis] !== undefined ? pct[axis] : 50;
                const scoreEl = document.getElementById(`score-${axis}`);
                if (scoreEl) scoreEl.textContent = `${val}%`;

                const barEl = document.getElementById(`bar-${axis}`);
                if (barEl) barEl.style.width = `${val}%`;
            });

            // 深層心理の解剖（本音・隠れたストレス源・盲点）
            const psych = res.psychology || {};
            const pDesire = document.getElementById('psych-desire');
            if (pDesire) pDesire.textContent = psych.core_desire || '';

            const pStruggle = document.getElementById('psych-struggle');
            if (pStruggle) pStruggle.textContent = psych.hidden_struggle || '';

            const pBlindspot = document.getElementById('psych-blindspot');
            if (pBlindspot) pBlindspot.textContent = psych.blind_spot || '';

            // 納得と共感の根拠
            const fRationale = document.getElementById('full-rationale');
            if (fRationale) fRationale.textContent = res.rationale || '';

            // 指南リスト
            const guidanceContainer = document.getElementById('full-guidance-list');
            if (guidanceContainer) {
                guidanceContainer.innerHTML = '';
                (res.guidance || []).forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs sm:text-sm text-slate-200 leading-relaxed';
                    div.textContent = item;
                    guidanceContainer.appendChild(div);
                });
            }

            // 業界・職種・雇用形態
            const career = res.career_options || {};
            const indContainer = document.getElementById('full-industries');
            if (indContainer) {
                indContainer.innerHTML = '';
                (career.industries || []).forEach(ind => {
                    const span = document.createElement('span');
                    span.className = 'px-3 py-1 rounded-lg bg-teal-950/70 text-teal-300 border border-teal-500/30 text-xs font-semibold';
                    span.textContent = ind;
                    indContainer.appendChild(span);
                });
            }

            const jobsContainer = document.getElementById('full-jobs');
            if (jobsContainer) {
                jobsContainer.innerHTML = '';
                (career.job_titles || []).forEach(job => {
                    const span = document.createElement('span');
                    span.className = 'px-3 py-1 rounded-lg bg-indigo-950/70 text-indigo-300 border border-indigo-500/30 text-xs font-semibold';
                    span.textContent = job;
                    jobsContainer.appendChild(span);
                });
            }

            const fEmp = document.getElementById('full-employment');
            if (fEmp) fEmp.textContent = career.recommended_employment || '';

            // CTAフック
            const cta = res.cta || {};
            const ctaTitle = document.getElementById('cta-hook-title');
            if (ctaTitle) ctaTitle.textContent = cta.hook_title || 'あなたにマッチする厳選求人をご紹介します';

            const ctaDesc = document.getElementById('cta-hook-desc');
            if (ctaDesc) ctaDesc.textContent = cta.hook_desc || '';

            // 相談フォームに診断結果をセット
            const formDiagType = document.getElementById('form-diagnosis-type');
            if (formDiagType) formDiagType.value = `[30問精密] ${res.name}`;

            // レーダーチャート描画
            this.renderRadarChart(pct);

            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // レーダーチャートの描画 (Chart.js)
        renderRadarChart(pct) {
            const ctx = document.getElementById('radarChart');
            if (!ctx) return;

            if (radarChartInstance) {
                radarChartInstance.destroy();
            }

            const dataValues = [
                pct.autonomy || 50,
                pct.innovation || 50,
                pct.people || 50,
                pct.growth || 50,
                pct.purpose || 50
            ];

            radarChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['自律裁量', '挑戦革新', '共感貢献', '成果成長', '社会的意義'],
                    datasets: [{
                        label: 'あなたの深層心理適性',
                        data: dataValues,
                        backgroundColor: 'rgba(20, 184, 166, 0.25)',
                        borderColor: '#14b8a6',
                        borderWidth: 2,
                        pointBackgroundColor: '#6366f1',
                        pointBorderColor: '#ffffff',
                        pointHoverBackgroundColor: '#ffffff',
                        pointHoverBorderColor: '#6366f1',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: {
                                color: '#94a3b8',
                                font: { size: 11, family: 'Noto Sans JP' }
                            },
                            suggestedMin: 0,
                            suggestedMax: 100,
                            ticks: {
                                display: false,
                                stepSize: 20
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        },

        // 相談フォームへのスクロール
        scrollToConsultation(diagType = null) {
            if (diagType === 'quick' && quickResultData) {
                const formDiagType = document.getElementById('form-diagnosis-type');
                if (formDiagType) formDiagType.value = `[クイック] ${quickResultData.result.name}`;
            }

            const target = document.getElementById('consultation-section');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        },

        // 連絡先入力タイプのトグル切り替え
        toggleContactInput() {
            const contactType = document.getElementById('form-contact-type')?.value;
            const label = document.getElementById('label-contact-info');
            const input = document.getElementById('form-contact-info');
            if (!label || !input) return;

            if (contactType === 'LINE') {
                label.innerHTML = 'LINE ID または 登録電話番号 <span class="text-rose-400">*</span>';
                input.placeholder = '例: line_id または 09012345678';
            } else if (contactType === 'Email') {
                label.innerHTML = 'メールアドレス <span class="text-rose-400">*</span>';
                input.placeholder = '例: sample@example.com';
            } else {
                label.innerHTML = 'オンライン面談用 メールアドレス <span class="text-rose-400">*</span>';
                input.placeholder = '例: sample@example.com（招待URLをお送りします）';
            }
        },

        // 相談フォームの送信処理
        async submitConsultation(event) {
            event.preventDefault();
            const btn = document.getElementById('btn-submit-lead');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span>送信中...</span>';
            }

            const payload = {
                diagnosis_type: document.getElementById('form-diagnosis-type')?.value || '未診断',
                name: document.getElementById('form-name')?.value || '',
                age: document.getElementById('form-age')?.value || '',
                service_type: document.getElementById('form-pref')?.value || '',
                contact_type: document.getElementById('form-contact-type')?.value || '',
                email: document.getElementById('form-contact-info')?.value || '',
                phone: document.getElementById('form-contact-info')?.value || '',
                note: document.getElementById('form-note')?.value || '',
                scores: answers
            };

            try {
                const res = await fetch('/api/consultation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('送信エラーが発生しました');
                const data = await res.json();

                // フォームを隠して成功メッセージを表示
                const form = document.getElementById('consultation-form');
                const successMsg = document.getElementById('lead-success-msg');
                const leadIdSpan = document.getElementById('lead-success-id');

                if (form) form.classList.add('hidden');
                if (successMsg) successMsg.classList.remove('hidden');
                if (leadIdSpan && data.lead_id) leadIdSpan.textContent = data.lead_id;

            } catch (err) {
                console.error('[Consultation Submit Error]', err);
                alert('送信に失敗しました。時間をおいて再度お試しください。');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span>無料で非公開求人案内・適職相談を予約する</span>';
                }
            }
        },

        // 全タイプ図鑑カタログ画面の表示
        async showCatalog(tab = 'deep') {
            this.hideAllViews();
            const viewCatalog = document.getElementById('view-catalog');
            if (viewCatalog) viewCatalog.classList.remove('hidden');

            await this.switchCatalogTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // カタログタブの切り替え
        async switchCatalogTab(tab) {
            currentCatalogTab = tab;
            const btnDeep = document.getElementById('btn-tab-deep');
            const btnQuick = document.getElementById('btn-tab-quick');

            if (tab === 'deep') {
                if (btnDeep) {
                    btnDeep.className = 'px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-indigo-600 to-teal-500 text-white shadow-md';
                }
                if (btnQuick) {
                    btnQuick.className = 'px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all text-slate-300 hover:text-white';
                }
            } else {
                if (btnQuick) {
                    btnQuick.className = 'px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-indigo-600 to-teal-500 text-white shadow-md';
                }
                if (btnDeep) {
                    btnDeep.className = 'px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all text-slate-300 hover:text-white';
                }
            }

            await this.renderCatalogGrid();
        },

        // カタロググリッドの描画
        async renderCatalogGrid() {
            const container = document.getElementById('catalog-grid');
            if (!container) return;

            const data = await this.loadTypesData();
            if (!data) {
                container.innerHTML = '<p class="text-xs text-rose-400 text-center col-span-2 py-8">タイプデータの読み込みに失敗しました。</p>';
                return;
            }

            container.innerHTML = '';

            if (currentCatalogTab === 'deep') {
                // 精密8タイプ
                const deepTypes = data.deep_types || {};
                Object.entries(deepTypes).forEach(([key, item]) => {
                    const card = document.createElement('div');
                    card.className = 'glass-card-hover p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl space-y-4 cursor-pointer flex flex-col justify-between group';
                    card.onclick = () => this.openTypeDetail(key, true);

                    const psych = item.psychology || {};
                    const career = item.career_options || {};
                    const jobs = (career.job_titles || []).slice(0, 3);

                    card.innerHTML = `
                        <div class="space-y-3">
                            <div class="flex items-center justify-between gap-2">
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-400/40">
                                    ${item.id ? item.id.replace(/_/g, ' ').toUpperCase() : 'DEEP TYPE'}
                                </span>
                                <span class="text-[11px] text-teal-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center space-x-1">
                                    <span>詳細を見る</span>
                                    <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                                </span>
                            </div>
                            <h3 class="text-base sm:text-lg font-black text-white group-hover:text-teal-300 transition-colors leading-snug">
                                ${item.name}
                            </h3>
                            <p class="text-xs text-teal-200/90 font-medium italic line-clamp-2">
                                ${item.catchphrase || ''}
                            </p>
                            <p class="text-xs text-slate-300 leading-relaxed line-clamp-2 pt-1 border-t border-slate-800">
                                <strong class="text-slate-100">本質欲求:</strong> ${psych.core_desire || ''}
                            </p>
                        </div>

                        <div class="pt-3 border-t border-slate-800/80 space-y-2">
                            <div class="text-[11px] text-slate-400 font-semibold">マッチ職種例:</div>
                            <div class="flex flex-wrap gap-1.5">
                                ${jobs.map(j => `<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-medium border border-slate-700/60">${j}</span>`).join('')}
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } else {
                // クイック4タイプ
                const quickTypes = data.quick_types || {};
                Object.entries(quickTypes).forEach(([key, item]) => {
                    const card = document.createElement('div');
                    card.className = 'glass-card-hover p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl space-y-4 cursor-pointer flex flex-col justify-between group';
                    card.onclick = () => this.openTypeDetail(key, false);

                    const traits = (item.key_traits || []).slice(0, 3);

                    card.innerHTML = `
                        <div class="space-y-3">
                            <div class="flex items-center justify-between gap-2">
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-950 text-teal-300 border border-teal-400/40">
                                    ${item.badge || 'QUICK TYPE'}
                                </span>
                                <span class="text-[11px] text-teal-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center space-x-1">
                                    <span>詳細を見る</span>
                                    <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                                </span>
                            </div>
                            <h3 class="text-base sm:text-lg font-black text-white group-hover:text-teal-300 transition-colors leading-snug">
                                ${item.name}
                            </h3>
                            <p class="text-xs text-teal-200/90 font-medium line-clamp-2">
                                ${item.tagline || ''}
                            </p>
                            <p class="text-xs text-slate-300 leading-relaxed line-clamp-3 pt-1 border-t border-slate-800">
                                ${item.summary || ''}
                            </p>
                        </div>

                        <div class="pt-3 border-t border-slate-800/80 space-y-2">
                            <div class="text-[11px] text-slate-400 font-semibold">コア特徴:</div>
                            <div class="flex flex-wrap gap-1.5">
                                ${traits.map(t => `<span class="px-2 py-0.5 rounded bg-slate-800 text-teal-300 text-[10px] font-medium border border-teal-500/20">#${t}</span>`).join('')}
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        },

        // タイプ詳細モーダルを開く
        async openTypeDetail(typeId, isDeep = true) {
            const data = await this.loadTypesData();
            if (!data) return;

            const modal = document.getElementById('catalog-modal');
            if (!modal) return;

            const source = isDeep ? data.deep_types : data.quick_types;
            const item = source ? source[typeId] : null;
            if (!item) return;

            currentSelectedType = { typeId, name: item.name, isDeep };

            // バッジ & ステージ名
            const mBadge = document.getElementById('modal-type-badge');
            if (mBadge) {
                mBadge.textContent = isDeep ? (item.id ? item.id.replace(/_/g, ' ').toUpperCase() : 'DEEP') : (item.badge || 'QUICK');
            }
            const mStage = document.getElementById('modal-type-stage');
            if (mStage) {
                mStage.textContent = isDeep ? '✨ 30問精密深層心理プロファイル' : '⚡ 5問クイック基本ワークスタイル';
            }

            // タイトル & キャッチ
            const mName = document.getElementById('modal-type-name');
            if (mName) mName.textContent = item.name;

            const mCatch = document.getElementById('modal-type-catchphrase');
            if (mCatch) mCatch.textContent = isDeep ? (item.catchphrase || '') : (item.tagline || '');

            // 心理3要素（精密用）/ 非表示（クイック用）
            const psychBox = document.getElementById('modal-psychology-box');
            if (psychBox) {
                if (isDeep) {
                    psychBox.classList.remove('hidden');
                    const psych = item.psychology || {};
                    const dEl = document.getElementById('modal-psych-desire');
                    if (dEl) dEl.textContent = psych.core_desire || '';
                    const sEl = document.getElementById('modal-psych-struggle');
                    if (sEl) sEl.textContent = psych.hidden_struggle || '';
                    const bEl = document.getElementById('modal-psych-blindspot');
                    if (bEl) bEl.textContent = psych.blind_spot || '';
                } else {
                    psychBox.classList.add('hidden');
                }
            }

            // 根拠 / 特徴概要
            const ratTitle = document.getElementById('modal-rationale-title');
            if (ratTitle) {
                ratTitle.textContent = isDeep ? '判定根拠 ＆ 思考傾向' : 'タイプの全体像 ＆ 概要';
            }
            const ratText = document.getElementById('modal-rationale-text');
            if (ratText) {
                ratText.textContent = isDeep ? (item.rationale || '') : (item.summary || '');
            }

            // 指南リスト（精密用）/ クイック時は非表示
            const guideBox = document.getElementById('modal-guidance-box');
            const guideList = document.getElementById('modal-guidance-list');
            if (guideBox && guideList) {
                if (isDeep && item.guidance && item.guidance.length > 0) {
                    guideBox.classList.remove('hidden');
                    guideList.innerHTML = '';
                    item.guidance.forEach(g => {
                        const div = document.createElement('div');
                        div.className = 'p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-xs leading-relaxed';
                        div.textContent = g;
                        guideList.appendChild(div);
                    });
                } else {
                    guideBox.classList.add('hidden');
                }
            }

            // 業界 & 職種 & 雇用形態
            const indContainer = document.getElementById('modal-industries');
            const jobContainer = document.getElementById('modal-jobs');
            const empBox = document.getElementById('modal-employment-box');
            const empEl = document.getElementById('modal-employment');

            if (isDeep) {
                const career = item.career_options || {};
                if (indContainer) {
                    indContainer.innerHTML = (career.industries || []).map(i => `<span class="px-2.5 py-1 rounded bg-teal-950/80 text-teal-300 border border-teal-500/30 text-[11px] font-semibold">${i}</span>`).join('');
                }
                if (jobContainer) {
                    jobContainer.innerHTML = (career.job_titles || []).map(j => `<span class="px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold">${j}</span>`).join('');
                }
                if (empBox && empEl) {
                    empBox.classList.remove('hidden');
                    empEl.textContent = career.recommended_employment || '柔軟な働き方';
                }
            } else {
                if (indContainer) {
                    indContainer.innerHTML = `<span class="px-2.5 py-1 rounded bg-teal-950/80 text-teal-300 border border-teal-500/30 text-[11px] font-semibold">${item.recommended_direction || '幅広い成長領域'}</span>`;
                }
                if (jobContainer) {
                    jobContainer.innerHTML = (item.key_traits || []).map(t => `<span class="px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold">#${t}</span>`).join('');
                }
                if (empBox) empBox.classList.add('hidden');
            }

            // モーダル表示
            modal.classList.remove('hidden');
        },

        // モーダルを閉じる
        closeTypeModal() {
            const modal = document.getElementById('catalog-modal');
            if (modal) modal.classList.add('hidden');
        },

        // モーダルから相談フォームへ進む
        selectTypeForConsultation() {
            this.closeTypeModal();
            this.hideAllViews();
            const viewFull = document.getElementById('view-full-result');
            if (viewFull) viewFull.classList.remove('hidden');

            const typeName = currentSelectedType ? currentSelectedType.name : 'カタログ選択タイプ';
            const formDiagType = document.getElementById('form-diagnosis-type');
            if (formDiagType) {
                formDiagType.value = `[図鑑選択] ${typeName}`;
            }

            this.scrollToConsultation();
        }
    };

    // グローバルオブジェクト window.app に登録
    window.app = app;

    // DOM読み込み完了時に自動初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }
})();
