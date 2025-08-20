(function(){
	const doc = document;
	const qs = (s, r=doc) => r.querySelector(s);
	const qsa = (s, r=doc) => Array.from(r.querySelectorAll(s));

	const modal = qs('#modal');
	const modalBody = qs('#modalBody');
	const openCreate = qs('#openCreate') || qs('[data-open-create]');
	const themeToggle = qs('#themeToggle');
	const taskList = qs('#taskList');
	const toastContainer = (()=>{
		let el = qs('#toastContainer');
		if(!el){ el = doc.createElement('div'); el.id = 'toastContainer'; el.className = 'toast-container'; doc.body.appendChild(el); }
		return el;
	})();

	function showToast(message, type='success', timeout=2500){
		const t = doc.createElement('div');
		t.className = `toast ${type}`;
		t.textContent = message;
		toastContainer.appendChild(t);
		setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(8px)'; t.addEventListener('transitionend', ()=> t.remove(), { once:true }); }, timeout);
	}

	function celebrate(){
		const layer = doc.createElement('div');
		layer.className = 'confetti';
		doc.body.appendChild(layer);
		const colors = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444'];
		const count = 80;
		for(let i=0;i<count;i++){
			const piece = doc.createElement('i');
			const x = Math.random()*100;
			const dur = 800 + Math.random()*1200;
			piece.style.left = x+'vw';
			piece.style.top = '-5vh';
			piece.style.background = colors[i%colors.length];
			piece.animate([
				{ transform: `translateY(0) rotate(0deg)`, opacity: 1 },
				{ transform: `translate(${(Math.random()*20-10)}vw, 110vh) rotate(${Math.random()*720-360}deg)`, opacity: 0.9 }
			], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
			layer.appendChild(piece);
		}
		setTimeout(()=> layer.remove(), 1800);
	}

	function setTheme(theme){
		doc.documentElement.setAttribute('data-theme', theme);
		try{ localStorage.setItem('tn_theme', theme); }catch(e){}
	}
	function initTheme(){
		const saved = localStorage.getItem('tn_theme');
		if(saved){ setTheme(saved); }
	}

	function openModal(content){
		modalBody.innerHTML = '';
		modalBody.appendChild(content);
		modal.classList.remove('hidden');
		modal.setAttribute('aria-hidden', 'false');
	}
	function closeModal(){
		modal.classList.add('hidden');
		modal.setAttribute('aria-hidden', 'true');
	}

	function fetchOptions(){
		const url = new URL(location.href);
		const q = qs('#searchInput')?.value || '';
		const status = qs('#statusFilter')?.value || 'all';
		const priority = qs('#priorityFilter')?.value || '';
		const category = qs('#categoryFilter')?.value || '';
		const sort = qs('#sortSelect')?.value || 'created';
		url.searchParams.set('q', q);
		url.searchParams.set('status', status);
		if(priority) url.searchParams.set('priority', priority); else url.searchParams.delete('priority');
		if(category) url.searchParams.set('category', category); else url.searchParams.delete('category');
		url.searchParams.set('sort', sort);
		history.replaceState({}, '', url.toString());
		return url.toString();
	}

	function bindRowEvents(row){
		row.querySelectorAll('form[data-ajax]').forEach(f=>f.addEventListener('submit', onAjaxSubmit));
		row.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click', () => openEdit(row)));
	}

	async function onAjaxSubmit(ev){
		ev.preventDefault();
		const form = ev.currentTarget;
		if(form.dataset.confirm && !confirm(form.dataset.confirm)) return;
		const resp = await fetch(form.action, { method: form.method || 'POST', body: new FormData(form), headers: {'X-Requested-With':'XMLHttpRequest'} });
		if(resp.headers.get('content-type')?.includes('text/html')){
			const html = await resp.text();
			const tmp = document.createElement('div'); tmp.innerHTML = html.trim();
			const li = tmp.firstElementChild;
			if(form.closest('li.task-item')){
				form.closest('li.task-item').replaceWith(li);
				bindRowEvents(li);
			}
			updateProgress();
			// Feedback
			if(form.action.includes('/toggle')){
				const completed = li.classList.contains('completed');
				showToast(completed ? 'Task completed!' : 'Task marked active', 'success');
				if(completed) celebrate();
			}
		} else {
			if(form.closest('li.task-item')){
				form.closest('li.task-item').remove();
			}
			updateProgress();
			// Assume deletes return non-HTML
			if(form.action.includes('/delete')){
				showToast('Task deleted', 'error');
			}
		}
	}

	function openEdit(row){
		const id = row.getAttribute('data-id');
		const tmpl = qs('#taskFormTemplate');
		const frag = tmpl.content.cloneNode(true);
		const form = frag.querySelector('#taskForm');
		form.action = `/tasks/${id}/update/`;
		// Pre-fill minimal fields
		frag.querySelector('input[name="title"]').value = row.querySelector('.title').textContent.trim();
		frag.querySelector('select[name="priority"]').value = (row.querySelector('.badge[class*="priority-"]')?.className.match(/priority-(\w+)/)||[])[1]||'medium';
		const due = row.querySelector('.badge.due')?.textContent.replace('Due','').trim();
		if(due){ frag.querySelector('input[name="due_date"]').value = due; }
		openModal(frag);
	}

	function openCreateForm(){
		const tmpl = qs('#taskFormTemplate');
		const frag = tmpl.content.cloneNode(true);
		openModal(frag);
	}

	async function submitInModal(ev){
		const form = ev.target.closest('form');
		if(!form) return;
		ev.preventDefault();
		const resp = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: {'X-Requested-With':'XMLHttpRequest'} });
		const html = await resp.text();
		if(resp.ok){
			const tmp = document.createElement('div'); tmp.innerHTML = html.trim();
			const li = tmp.firstElementChild;
			if(qs('#taskList')){
				qs('#taskList').insertAdjacentElement('afterbegin', li);
				bindRowEvents(li);
			}
			closeModal();
			updateProgress();
		} else {
			modalBody.innerHTML = html;
		}
	}

	function updateProgress(){
		const items = qsa('li.task-item');
		const done = items.filter(i=>i.classList.contains('completed')).length;
		const pct = items.length? Math.round((done/items.length)*100): 0;
		qs('#progress')?.style.setProperty('--progress', pct+'%');
	}

	function setupFilters(){
		['#searchInput','#statusFilter','#priorityFilter','#categoryFilter','#sortSelect'].forEach(sel=>{
			const el = qs(sel);
			if(!el) return;
			el.addEventListener('input', ()=>{ navigate(fetchOptions()); });
			el.addEventListener('change', ()=>{ navigate(fetchOptions()); });
		});

		// Sidebar quick links for status
		qsa('[data-status]').forEach(link=>{
			link.addEventListener('click', (e)=>{
				e.preventDefault();
				const v = link.getAttribute('data-status');
				const statusInput = qs('#statusFilter');
				if(statusInput){ statusInput.value = v; }
				// If selecting "All", also clear priority to mirror server logic for the All tab
				if(v === 'all'){
					const prioritySelect = qs('#priorityFilter');
					if(prioritySelect){ prioritySelect.value = ''; }
				}
				navigate(fetchOptions());
			});
		});

		// Tabs for priority (High/Medium/Low)
		qsa('[data-priority]').forEach(link=>{
			link.addEventListener('click', (e)=>{
				e.preventDefault();
				const v = link.getAttribute('data-priority') || '';
				const prioritySelect = qs('#priorityFilter');
				if(prioritySelect){ prioritySelect.value = v; }
				navigate(fetchOptions());
			});
		});
	}

	async function navigate(url){
		// Show skeletons while loading
		const list = qs('#taskList');
		if(list){
			const count = Math.max(3, Math.min(6, list.children.length||4));
			list.innerHTML = Array.from({length:count}).map(()=>`<li class="task-item skeleton" style="height:56px; border-radius:12px"></li>`).join('');
		}
		const resp = await fetch(url, { headers: {'X-Requested-With':'XMLHttpRequest'} });
		if(!resp.ok){ location.assign(url); return; }
		const html = await resp.text();
		// Replace only the main board content to feel instant
		const tmp = document.createElement('div'); tmp.innerHTML = html;
		const next = tmp.querySelector('.board');
		const cur = qs('.board');
		if(next && cur){
			cur.replaceWith(next);
			// Rebind events for new nodes
			qsa('form[data-ajax]').forEach(f=>f.addEventListener('submit', onAjaxSubmit));
			qsa('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.closest('li'))));
			qsa('[data-open-create]').forEach(el=>el.addEventListener('click', openCreateForm));
			setupDnd();
			updateProgress();
		}
		// Update active tabs/buttons visual state
		qsa('[data-status]').forEach(btn=>{
			const val = btn.getAttribute('data-status');
			const currentStatus = qs('#statusFilter')?.value || 'all';
			const currentPriority = qs('#priorityFilter')?.value || '';
			const isAllTab = val === 'all';
			// Only highlight "All" when status is all AND no priority is set
			const active = isAllTab ? (currentStatus === 'all' && !currentPriority) : (val === currentStatus);
			btn.classList.toggle('active', active);
		});
		qsa('[data-priority]').forEach(tab=>{
			const current = qs('#priorityFilter')?.value || '';
			tab.classList.toggle('active', tab.getAttribute('data-priority') === current);
		});
	}

	function setupDnd(){
		let dragged;
		qsa('#taskList > li').forEach(li=>{
			li.setAttribute('draggable','true');
			li.addEventListener('dragstart', ()=> dragged = li);
			li.addEventListener('dragover', e=>{ e.preventDefault(); });
			li.addEventListener('drop', ()=>{
				if(dragged===li) return;
				li.parentNode.insertBefore(dragged, li);
				saveOrder();
			});
		});
	}

	async function saveOrder(){
		const ids = qsa('#taskList > li').map(li=>li.getAttribute('data-id'));
		const form = new URLSearchParams();
		ids.forEach(id=>form.append('order[]', id));
		await fetch('/tasks/reorder/', { method: 'POST', headers: {'X-Requested-With':'XMLHttpRequest','X-CSRFToken': getCsrf()}, body: form });
	}

	function getCsrf(){
		const name = 'csrftoken=';
		return (document.cookie.split(';').find(c=>c.trim().startsWith(name))||'').split('=').pop()||'';
	}

	function restoreFilters(){
		try{
			const saved = JSON.parse(localStorage.getItem('tn_filters')||'{}');
			Object.entries(saved).forEach(([k,v])=>{ const el = qs(k); if(el){ el.value=v; }});
		}catch(e){}
	}
	function persistFilters(){
		const filters = ['#statusFilter','#priorityFilter','#categoryFilter','#sortSelect'].reduce((acc,sel)=>{
			const el = qs(sel); if(el){ acc[sel]=el.value; } return acc;
		},{});
		try{ localStorage.setItem('tn_filters', JSON.stringify(filters)); }catch(e){}
	}

	// Events
	openCreate?.addEventListener('click', openCreateForm);
	modal?.addEventListener('click', (e)=>{ if(e.target.hasAttribute('data-close')||e.target.classList.contains('modal-backdrop')) closeModal(); });
	modal?.addEventListener('submit', submitInModal);
	qsa('form[data-ajax]').forEach(f=>f.addEventListener('submit', onAjaxSubmit));
	qsa('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.closest('li'))));
	qsa('[data-open-create]').forEach(el=>el.addEventListener('click', openCreateForm));
	qsa('#statusFilter,#priorityFilter,#categoryFilter,#sortSelect').forEach(el=>el?.addEventListener('change', persistFilters));
	qs('#searchInput')?.addEventListener('input', ()=>{ /* real-time search via server navigation */ });

	// Keyboard shortcuts
	doc.addEventListener('keydown', (e)=>{
		if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); qs('#searchInput')?.focus(); }
		if(e.key.toLowerCase()==='n'){ e.preventDefault(); openCreateForm(); }
		if(['1','2','3'].includes(e.key)){
			const map = { '1': 'high', '2': 'medium', '3': 'low' };
			const sel = qs('#priorityFilter'); if(sel){ sel.value = map[e.key]; navigate(fetchOptions()); }
		}
	});
	
	themeToggle?.addEventListener('click', ()=>{
		const cur = doc.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
		setTheme(cur);
	});

	initTheme();
	updateProgress();
	setupFilters();
	restoreFilters();
	setupDnd();
})();


