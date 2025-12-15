document.addEventListener('DOMContentLoaded', function () {

    const rows = document.querySelectorAll('#projectTable tbody tr');

    const detailId = document.getElementById('detail-project-id');
    const detailName = document.getElementById('detail-project-name');
    const detailDesc = document.getElementById('detail-project-desc');
    const detailManager = document.getElementById('detail-project-manager-id');
    const detailBudget = document.getElementById('detail-project-budget');
    const detailStart = document.getElementById('detail-project-start');
    const detailEnd = document.getElementById('detail-project-end');
    const detailTeam = document.getElementById('detail-project-team');

    const worklogList = document.getElementById('worklog-list');
    const newWorklogEmployee = document.getElementById('new-worklog-employee');
    const newWorklogHours = document.getElementById('new-worklog-hours');
    const btnAddWorklog = document.getElementById('btn-add-worklog');
    const totalHoursSpan = document.getElementById('total-hours');

    const milestoneModal = document.getElementById('milestoneModal');
    const milestoneTableBody = document.getElementById('milestoneTableBody');
    const milestoneProjectTitle = document.getElementById('milestoneProjectTitle');
    const btnViewMilestones = document.getElementById('btn-view-milestones');

    let selectedProjectId = null;
    let selectedTeamIds = [];
    let worklogs = [];
    let selectedMilestones = [];

    // ----------------------------- Helper: Set Project ID Editable
    function setProjectFormMode(isNew) {
        if (isNew) {
            detailId.removeAttribute('readonly'); detailId.classList.remove('bg-light');
        } else {
            detailId.setAttribute('readonly', true); detailId.classList.add('bg-light');
        }
        detailTeam.removeAttribute('readonly'); detailTeam.classList.remove('bg-light');
    }

    // ----------------------------- Load project details
    rows.forEach(row => row.addEventListener('click', () => loadProject(row)));

    function loadProject(row) {
        selectedProjectId = row.dataset.projectId;
        setProjectFormMode(false);

        detailId.value = selectedProjectId || '';
        detailName.value = row.dataset.projectName || '';
        detailDesc.value = row.dataset.projectDesc || '';
        detailManager.value = row.dataset.projectManagerId || '';
        detailBudget.value = row.dataset.projectBudget || '';
        detailStart.value = row.dataset.projectStart || '';
        detailEnd.value = row.dataset.projectEnd || '';
        detailTeam.value = row.dataset.projectTeamNames || '';

        selectedTeamIds = (row.dataset.projectTeamIds || '').split(',').map(id => parseInt(id.trim())).filter(n => !isNaN(n));

        worklogs = JSON.parse(row.dataset.projectWorklogs || '[]');
        selectedMilestones = JSON.parse(row.dataset.projectMilestones || '[]');

        milestoneProjectTitle.textContent = `${row.dataset.projectName} (Project #${selectedProjectId})`;

        renderWorklogs();
        renderMilestoneRows();
    }

    // ----------------------------- Worklogs
    function renderWorklogs() {
        if (worklogs.length === 0) {
            worklogList.innerHTML = '<span class="text-muted">No worklogs yet</span>';
            totalHoursSpan.textContent = '0';
            return;
        }

        worklogList.innerHTML = worklogs.map((w,i) => `
            <div class="d-flex justify-content-between mb-1">
                <span>${w.employee}: ${w.hours}h</span>
                <div>
                    <button class="btn btn-sm btn-danger btn-delete-worklog" data-index="${i}" data-id="${w.id || ''}">Delete</button>
                </div>
            </div>
        `).join('');

        totalHoursSpan.textContent = worklogs.reduce((sum,w) => sum + parseFloat(w.hours||0), 0);
    }

    btnAddWorklog.addEventListener('click', () => {
        const employee = newWorklogEmployee.value.trim();
        const hours = parseFloat(newWorklogHours.value);
        if (!employee || isNaN(hours) || !selectedProjectId) { alert('Enter valid employee, hours and select a project'); return; }

        fetch(`/worklogs/create`, {
            method:'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({project_id:selectedProjectId, employee, hours})
        })
        .then(res=>res.json())
        .then(data=>{
            worklogs.push({id:data.id, employee:data.employee, hours:parseFloat(data.hours)});
            renderWorklogs();
            newWorklogEmployee.value=''; newWorklogHours.value='';
            updateProjectRowWorklogs();
        }).catch(()=>alert('Failed to add worklog'));
    });

    worklogList.addEventListener('click', e=>{
        if(!e.target.classList.contains('btn-delete-worklog')) return;
        const index = e.target.dataset.index;
        const worklogId = e.target.dataset.id;
        if(!confirm(`Delete worklog for ${worklogs[index].employee}?`)) return;

        if(worklogId) {
            fetch(`/worklogs/${worklogId}/delete`, {method:'POST'})
            .then(res=>res.json())
            .then(()=>{
                worklogs.splice(index,1);
                renderWorklogs();
                updateProjectRowWorklogs();
            }).catch(()=>alert('Failed to delete worklog'));
        } else {
            worklogs.splice(index,1);
            renderWorklogs();
            updateProjectRowWorklogs();
        }
    });

    function updateProjectRowWorklogs() {
        const row = document.querySelector(`#projectTable tbody tr[data-project-id='${selectedProjectId}']`);
        if(row){
            row.querySelector('td:last-child').textContent = worklogs.reduce((sum,w)=>sum+parseFloat(w.hours||0),0);
            row.dataset.projectWorklogs = JSON.stringify(worklogs);
        }
    }

    // ----------------------------- Milestones
    btnViewMilestones.addEventListener('click', () => {
        if(!selectedProjectId){ alert('Select a project first'); return; }
        renderMilestoneRows();
        milestoneModal.style.display='flex';
    });

    function renderMilestoneRows() {
        milestoneTableBody.innerHTML = '';
        const projectCompleted = !!detailEnd.value;
        if(selectedMilestones.length===0){
            milestoneTableBody.innerHTML='<tr><td colspan="5" class="text-center text-muted">No milestones defined</td></tr>';
        } else {
            selectedMilestones.forEach((m,i)=>{
                milestoneTableBody.insertAdjacentHTML('beforeend',`
                    <tr>
                        <td>${m.title}</td>
                        <td>${m.description}</td>
                        <td><span class="badge bg-${m.status==='Completed'?'success':m.status==='In Progress'?'warning':'secondary'}">${m.status}</span></td>
                        <td>${m.due_date||''}</td>
                        <td>
                            <button class="btn btn-sm btn-primary btn-edit-milestone" data-index="${i}">Edit</button>
                            <button class="btn btn-sm btn-danger btn-delete-milestone" data-index="${i}" data-id="${m.id||''}">Delete</button>
                        </td>
                    </tr>
                `);
            });
        }

        const addRow = document.createElement('tr');
        addRow.innerHTML=`<td colspan="5" class="text-center"><button id="btn-add-new-milestone" class="btn btn-success mt-2">+ Add Milestone</button></td>`;
        milestoneTableBody.appendChild(addRow);

        document.querySelectorAll('.btn-edit-milestone').forEach(btn=>{
            btn.addEventListener('click', e=>{
                if(projectCompleted){ alert('Remove project end date to edit milestones'); return; }
                openEditMilestoneForm(selectedMilestones[e.target.dataset.index], e.target.dataset.index);
            });
        });

        document.querySelectorAll('.btn-delete-milestone').forEach(btn=>{
            btn.addEventListener('click', e=>{
                const index = e.target.dataset.index; const m = selectedMilestones[index];
                if(!confirm(`Delete milestone "${m.title}"?`)) return;
                if(m.id){
                    fetch(`/milestones/${m.id}/delete`, {method:'POST'})
                    .then(res=>res.json())
                    .then(()=>{
                        selectedMilestones.splice(index,1);
                        renderMilestoneRows(); updateProjectRowMilestones();
                    }).catch(()=>alert('Failed to delete milestone'));
                } else {
                    selectedMilestones.splice(index,1);
                    renderMilestoneRows(); updateProjectRowMilestones();
                }
            });
        });

        document.getElementById('btn-add-new-milestone')?.addEventListener('click', ()=>{
            if(projectCompleted){ alert('Remove project end date to add milestones'); return; }
            const m={title:'',description:'',status:'Pending',due_date:''};
            selectedMilestones.push(m);
            openEditMilestoneForm(m, selectedMilestones.length-1,true);
        });
    }

    function openEditMilestoneForm(milestone,index,isNew=false){
        const formHtml = `
            <tr id="editMilestoneForm" class="bg-light">
                <td><input class="form-control milestone-title" value="${milestone.title}"></td>
                <td><textarea class="form-control milestone-desc">${milestone.description}</textarea></td>
                <td>
                    <select class="form-control milestone-status">
                        <option ${milestone.status==='Pending'?'selected':''}>Pending</option>
                        <option ${milestone.status==='In Progress'?'selected':''}>In Progress</option>
                        <option ${milestone.status==='Completed'?'selected':''}>Completed</option>
                    </select>
                </td>
                <td><input type="date" class="form-control milestone-due-date" value="${milestone.due_date}"></td>
                <td>
                    <button class="btn btn-sm btn-success btn-save-milestone">Save</button>
                    <button class="btn btn-sm btn-secondary btn-cancel-milestone">Cancel</button>
                </td>
            </tr>
        `;
        document.getElementById('editMilestoneForm')?.remove();
        milestoneTableBody.insertAdjacentHTML('beforeend', formHtml);

        document.querySelector('.btn-cancel-milestone').addEventListener('click',()=>{
            if(isNew) selectedMilestones.splice(index,1);
            renderMilestoneRows();
        });

        document.querySelector('.btn-save-milestone').addEventListener('click',()=>{
            milestone.title = document.querySelector('.milestone-title').value;
            milestone.description = document.querySelector('.milestone-desc').value;
            milestone.status = document.querySelector('.milestone-status').value;
            milestone.due_date = document.querySelector('.milestone-due-date').value;

            if(isNew){
                fetch(`/milestones/create`, {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({project_id:selectedProjectId, ...milestone})
                })
                .then(res=>res.json())
                .then(data=>{ milestone.id=data.id; renderMilestoneRows(); updateProjectRowMilestones(); })
                .catch(()=>alert('Failed to save milestone'));
            } else {
                fetch(`/milestones/${milestone.id}/update`,{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify(milestone)
                })
                .then(()=>{ renderMilestoneRows(); updateProjectRowMilestones(); })
                .catch(()=>alert('Failed to update milestone'));
            }
        });
    }

    function updateProjectRowMilestones(){
        const row=document.querySelector(`#projectTable tbody tr[data-project-id='${selectedProjectId}']`);
        if(row) row.dataset.projectMilestones = JSON.stringify(selectedMilestones);
    }

    // ----------------------------- Modal close
    document.getElementById('milestoneModalCloseBtn').addEventListener('click',()=>milestoneModal.style.display='none');
    window.addEventListener('click', e=>{ if(e.target===milestoneModal) milestoneModal.style.display='none'; });

});

