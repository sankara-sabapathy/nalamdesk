import { Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { PdfService } from '../../services/pdf.service';
import { PrescriptionComponent } from '../../visits/prescription/prescription.component';
import { CatalogTypeaheadComponent } from '../../shared/components/catalog-typeahead/catalog-typeahead.component';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/api.service';
import { newRequestId } from '../../services/request-id';
import { combineLatest } from 'rxjs';
import { VitalsFormComponent } from '../vitals/vitals-form.component';

interface PrescriptionItem {
  medicine: string;
  frequency: string;
  duration?: string;
  instructions?: string;
}

interface Visit {
  id: number;
  date: string;
  diagnosis: string;
  diagnosis_type?: string;
  symptoms?: string;
  examination_notes?: string;
  prescription: PrescriptionItem[];
  amount_paid: number;
  patient_id?: number;
  doctor_id?: number;
}

@Component({
  selector: 'app-visit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PrescriptionComponent, CatalogTypeaheadComponent, VitalsFormComponent],
  template: `
    <div class="flex h-full bg-gray-50 font-sans overflow-hidden relative">
      
      <!-- Mobile Backdrop -->
      <div *ngIf="showMobileHistory" (click)="showMobileHistory = false" class="fixed inset-0 bg-black/50 z-40 md:hidden glass"></div>

      <!-- Left Panel: History & Context (Responsive Drawer) -->
      <div class="fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl transition-transform duration-300 md:relative md:translate-x-0 md:shadow-none"
           [class.translate-x-0]="showMobileHistory"
           [class.-translate-x-full]="!showMobileHistory">
        
        <!-- Back & Header -->
        <div class="p-4 border-b bg-gray-50 flex justify-between items-start">
          <div>
            <button (click)="goBack()" class="text-xs text-gray-500 hover:text-blue-600 mb-2 flex items-center gap-1 font-medium">
                <span class="text-lg">‹</span> Back to Queue
            </button>
            <div *ngIf="patient">
                <h2 class="font-bold text-lg text-gray-800 leading-tight">{{ patient.name }}</h2>
                <p class="text-xs text-gray-500 font-medium mt-1">{{ patient.age }} / {{ patient.gender }} • {{ patient.mobile }}</p>
            </div>
          </div>
          <!-- Close Drawer Button (Mobile Only) -->
           <button (click)="showMobileHistory = false" class="md:hidden text-gray-500 p-1">
             ✕
           </button>
        </div>

        <!-- Scrollable History List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-100/50">
           
           <!-- Last Visit PINNED CARD -->
           <div *ngIf="history.length > 0; else noHistory" class="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm relative group">
              <div class="flex justify-between items-start mb-2">
                 <span class="text-xs font-bold text-blue-800 uppercase tracking-wider">Last Visit</span>
                 <span class="text-xs text-blue-600">{{ history[0].date | date:'mediumDate' }}</span>
              </div>
              
              <div class="text-sm text-gray-800 font-medium mb-1 line-clamp-2" title="{{ history[0].diagnosis }}">
                {{ history[0].diagnosis || 'No Diagnosis' }}
              </div>
              
              <div class="text-xs text-gray-600 space-y-1 mb-3">
                 <div *ngFor="let med of history[0].prescription | slice:0:3">
                    • {{ med.medicine }}
                 </div>
                 <div *ngIf="(history[0].prescription?.length || 0) > 3" class="text-gray-400 italic">+ more</div>
              </div>

              <!-- COPY ACTION -->
              <button *ngIf="canEditChart" (click)="copyLastVisit()" class="w-full py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 hover:text-blue-900 transition flex items-center justify-center gap-2 shadow-sm">
                <span>📋</span> Copy to Current
              </button>
           </div>
           <ng-template #noHistory>
              <div class="text-center py-8 text-gray-400 text-sm italic">No previous visits.</div>
           </ng-template>

           <!-- Divider -->
           <div *ngIf="history.length > 1" class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2 px-1">Older History</div>

           <!-- Older items -->
           <div *ngFor="let visit of history | slice:1" (click)="editVisit(visit)"
                class="bg-white border rounded p-3 transition shadow-sm"
                [class.hover:border-blue-400]="!isConsulting && !activeEncounterReadOnly" [class.cursor-pointer]="!isConsulting && !activeEncounterReadOnly"
                [class.opacity-60]="isConsulting || activeEncounterReadOnly"
                [class.ring-2]="editingVisitId === visit.id" [class.ring-blue-500]="editingVisitId === visit.id">
              <p class="text-xs text-gray-500 mb-1">{{ visit.date | date:'mediumDate' }}</p>
              <p class="text-sm font-medium text-gray-800 truncate">{{ visit.diagnosis }}</p>
           </div>
        </div>
      </div>

      <!-- Main Panel: The "Chart" (Vertical Document) -->
      <div class="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <div *ngIf="consultationLoadError" class="m-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3">
          <span>{{ consultationLoadError }}</span>
          <button type="button" (click)="retryConsultationLoad()" class="rounded bg-amber-700 px-3 py-1.5 font-semibold text-white hover:bg-amber-800">Retry</button>
        </div>
        
        <!-- Header / Toolbar -->
        <div class="min-h-16 py-2 border-b flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 bg-white z-20 sticky top-0 gap-2">
           <div class="flex items-center gap-3">
               <!-- Mobile Toggle -->
               <button (click)="showMobileHistory = !showMobileHistory" class="md:hidden btn btn-circle btn-sm btn-ghost">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                   </svg>
               </button>

               <h1 class="text-lg md:text-xl font-bold text-gray-800 truncate">
                 {{ isViewMode ? 'View Visit' : (editingVisitId ? 'Editing Past Visit' : (isLiveConsultation ? 'Current Consultation' : 'Visit')) }}
               </h1>
           </div>

           <div class="flex flex-wrap gap-2 items-center justify-end">
              <button *ngIf="editingVisitId && !isViewMode" (click)="deleteVisit()" class="border border-red-200 text-red-600 bg-white hover:bg-red-50 px-3 py-1 rounded text-sm font-medium transition">Delete</button>
              <button *ngIf="editingVisitId && !isViewMode" (click)="resetForm()" class="border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 px-3 py-1 rounded text-sm font-medium transition">New Visit</button>
              <div class="text-right flex items-center gap-2" *ngIf="isViewMode">
                  <div class="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-bold">VIEW</div>
              </div>
              <div class="text-right flex items-center gap-2" *ngIf="isLiveConsultation">
                  <div class="hidden md:block text-xs text-gray-500 uppercase tracking-wider font-bold">Status</div>
                  <div class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold gap-1 flex items-center">
                    <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> LIVE
                  </div>
              </div>
           </div>
        </div>

        <!-- SCROLLABLE DOCUMENT BODY -->
        <div class="flex-1 overflow-y-auto bg-gray-50/50">
           <div class="w-full px-4 md:px-8 py-8">
              <form [formGroup]="visitForm" class="space-y-6">
                 
                 <!-- PATIENT CLINICAL SAFETY CONTEXT BANNER -->
                 <div class="rounded-xl border p-4 shadow-sm"
                      [ngClass]="patientSafetyContext?.has_active_allergies ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-200'">
                     <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                         <div class="flex items-center gap-2">
                             <span class="text-base">🛡️</span>
                             <span class="font-bold text-xs text-gray-700 uppercase tracking-wider">Patient Safety Context</span>
                         </div>
                         <div class="flex items-center gap-2">
                             <span *ngIf="patientSafetyContext?.has_active_allergies" 
                                   class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white flex items-center gap-1 shadow-sm">
                                 <span>⚠️</span>
                                 <span>{{ patientSafetyContext.active_allergies.length }} Active {{ patientSafetyContext.active_allergies.length === 1 ? 'Allergy' : 'Allergies' }}</span>
                                 <span *ngIf="patientSafetyContext.has_life_threatening_allergies" class="ml-1 uppercase text-[10px] bg-red-900 text-red-100 px-1 rounded">High Risk</span>
                             </span>
                             <span *ngIf="patientSafetyContext && !patientSafetyContext.has_active_allergies" 
                                   class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                 <span>✓</span> No Known Allergies
                             </span>
                         </div>
                     </div>

                     <!-- Active Safety Details -->
                     <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                         <!-- Active Allergies List -->
                         <div class="p-2.5 rounded-lg border bg-white/90" [class.border-red-200]="patientSafetyContext?.has_active_allergies" [class.border-gray-100]="!patientSafetyContext?.has_active_allergies">
                             <div class="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">Known Allergies</div>
                             <div *ngIf="patientSafetyContext?.active_allergies?.length; else noActiveAllergies" class="flex flex-wrap gap-1">
                                 <span *ngFor="let a of patientSafetyContext.active_allergies" 
                                       class="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200"
                                       [title]="(a.reaction ? 'Reaction: ' + a.reaction : '') + (a.criticality ? ' (' + a.criticality + ' criticality)' : '')">
                                     {{ a.substance }}
                                 </span>
                             </div>
                             <ng-template #noActiveAllergies>
                                 <div class="text-gray-400 italic">None recorded</div>
                             </ng-template>
                         </div>

                         <!-- Active Problem List -->
                         <div class="p-2.5 rounded-lg border bg-white/90 border-gray-100">
                             <div class="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">Active Problems</div>
                             <div *ngIf="patientSafetyContext?.active_conditions?.length; else noActiveConditions" class="flex flex-wrap gap-1">
                                 <span *ngFor="let c of patientSafetyContext.active_conditions" 
                                       class="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
                                     {{ c.condition_name }}
                                 </span>
                             </div>
                             <ng-template #noActiveConditions>
                                 <div class="text-gray-400 italic">None recorded</div>
                             </ng-template>
                         </div>

                         <!-- Current Medications -->
                         <div class="p-2.5 rounded-lg border bg-white/90 border-gray-100">
                             <div class="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">Current Medications</div>
                             <div *ngIf="patientSafetyContext?.active_medications?.length; else noActiveMeds" class="flex flex-wrap gap-1">
                                 <span *ngFor="let m of patientSafetyContext.active_medications" 
                                       class="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-900 border border-blue-200">
                                     {{ m.medicine_name }} <span *ngIf="m.dosage" class="text-[10px] text-blue-700">({{ m.dosage }})</span>
                                 </span>
                             </div>
                             <ng-template #noActiveMeds>
                                 <div class="text-gray-400 italic">None recorded</div>
                             </ng-template>
                         </div>
                     </div>
                 </div>

                 <!-- SECTION 1: SUBJECTIVE -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div class="flex items-center gap-3 mb-4 text-gray-800">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">S</div>
                        <h3 class="text-lg font-bold">Subjective</h3>
                    </div>
                    <textarea formControlName="symptoms" rows="3" placeholder="Chief complaints, history of present illness..." 
                        class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700 placeholder-gray-400"></textarea>
                 </div>

                 <!-- SECTION 2: OBJECTIVE -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                        <div class="flex items-center gap-3 text-gray-800">
                            <div class="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">O</div>
                            <h3 class="text-lg font-bold">Objective</h3>
                        </div>
                        <!-- Vitals Pill & Actions -->
                        <div class="flex items-center gap-2 flex-wrap">
                            <div *ngIf="hasVitalsToDisplay(patientVitals)" 
                                 (click)="openVitalsModal()"
                                 title="Click to view or amend vitals"
                                 class="bg-teal-50 text-teal-800 text-xs px-3 py-1.5 rounded-full font-medium border border-teal-100 flex flex-wrap items-center gap-2.5 cursor-pointer hover:bg-teal-100 transition">
                                <span *ngIf="hasBp(patientVitals)">BP: <b>{{ patientVitals.systolic_bp }}/{{ patientVitals.diastolic_bp }}</b></span>
                                <span *ngIf="isVitalPresent(patientVitals.pulse)">Pulse: <b>{{ patientVitals.pulse }}</b></span>
                                <span *ngIf="isVitalPresent(patientVitals.temperature)">Temp: <b>{{ patientVitals.temperature }}</b></span>
                                <span *ngIf="isVitalPresent(patientVitals.spo2)">SpO2: <b>{{ patientVitals.spo2 }}%</b></span>
                                <span *ngIf="patientVitals.status === 'amended'" class="text-[10px] bg-teal-200 text-teal-900 px-1.5 py-0.5 rounded font-bold">Amended</span>
                                <span *ngIf="canEditChart" class="text-teal-600 font-bold ml-1 text-xs">✎</span>
                            </div>

                            <button *ngIf="!hasVitalsToDisplay(patientVitals) && canEditChart" 
                                    type="button" 
                                    (click)="openVitalsModal()"
                                    class="text-xs text-teal-700 hover:text-teal-900 border border-teal-200 hover:border-teal-400 bg-teal-50 px-2.5 py-1 rounded-full flex items-center gap-1 font-medium transition">
                                <span>+ Record Vitals</span>
                            </button>
                        </div>
                    </div>
                    <textarea formControlName="examination_notes" rows="3" placeholder="Physical exam findings, labs, observations..." 
                        class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition text-gray-700 placeholder-gray-400"></textarea>
                 </div>

                 <!-- SECTION 3: ASSESSMENT -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                    <div class="flex items-center gap-3 mb-4 text-gray-800">
                        <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">A</div>
                        <h3 class="text-lg font-bold">Assessment</h3>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="md:col-span-3">
                             <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Diagnosis <span class="text-red-500">*</span></label>
                             <app-catalog-typeahead
                                [value]="visitForm.get('diagnosis')?.value || ''"
                                [disabled]="!canEditChart"
                                placeholder="Primary Diagnosis"
                                testId="diagnosis-input"
                                [searchFn]="searchConditions"
                                [createFn]="createCondition"
                                (valueChange)="onDiagnosisTyped($event)"
                                (picked)="onConditionPicked($event)">
                             </app-catalog-typeahead>
                             <p *ngIf="visitForm.get('diagnosis')?.invalid && (visitForm.get('diagnosis')?.dirty)" class="text-xs text-red-500 mt-1">Diagnosis is required</p>
                        </div>
                        <div class="md:col-span-1">
                             <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                             <select formControlName="diagnosis_type" class="w-full p-2.5 border border-gray-300 rounded bg-white">
                                <option value="">Select</option>
                                <option value="Provisional">Provisional</option>
                                <option value="Final">Final</option>
                             </select>
                        </div>
                    </div>
                 </div>

                 <!-- SECTION 4: PLAN (Rx) -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div class="flex items-center gap-3 mb-4 text-gray-800">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">P</div>
                        <h3 class="text-lg font-bold">Plan & Rx</h3>
                    </div>
                    
                    <app-prescription 
                        [initialData]="currentPrescription"
                        [disabled]="!canEditChart"
                        (changed)="updatePrescription($event)">
                    </app-prescription>

                    <div class="mt-6 pt-4 border-t w-full md:w-1/3">
                         <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Total Fee (₹)</label>
                         <input type="number" formControlName="amount_paid" class="w-full p-2 border border-gray-300 rounded font-mono font-bold text-gray-700">
                    </div>
                 </div>
                 
                 <!-- Spacer for footer -->
                 <div class="h-24"></div>
              </form>
           </div>
        </div>

        <!-- STICKY FOOTER ACTION BAR -->
        <div class="min-h-20 bg-white border-t px-4 md:px-8 flex flex-col md:flex-row items-center justify-between z-30 py-3 gap-3">
            <div class="flex gap-3 w-full md:w-auto justify-center md:justify-start">
               <button *ngIf="isViewMode" type="button" (click)="downloadVisitPdf()" [disabled]="!viewedVisit" class="px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900 font-medium transition flex-1 md:flex-none justify-center disabled:opacity-50">
                 Download PDF
               </button>
               <button *ngIf="!isViewMode" type="button" (click)="printPrescription()" class="px-4 py-2 rounded text-gray-600 hover:bg-gray-100 font-medium transition flex-1 md:flex-none justify-center">
                 Print
               </button>
               <button *ngIf="isLiveConsultation" type="button" (click)="postponeConsult()" class="px-4 py-2 rounded text-blue-600 border border-transparent hover:border-blue-200 hover:bg-blue-50 font-medium transition flex-1 md:flex-none justify-center">
                 ⏸ Postpone
               </button>
            </div>

            <div class="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
               <ng-container *ngIf="canEditChart; else noConsult">
                  <!-- Classic Save -->
                   <button type="submit" (click)="saveVisit()" [disabled]="!visitForm.valid || actionInFlight" class="hidden md:block px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition disabled:opacity-50 font-medium">
                     Save Progress
                   </button>
                   
                   <!-- Finish & Exit -->
                   <button *ngIf="isLiveConsultation" type="button" (click)="endConsult()" [disabled]="!visitForm.valid || actionInFlight" class="hidden md:block px-4 py-2 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 transition disabled:opacity-50 font-medium">
                     Finish & Exit
                   </button>

                   <!-- HERO ACTION: FINISH & NEXT -->
                   <button *ngIf="isLiveConsultation" type="button" (click)="finishAndNext()" [disabled]="!visitForm.valid || actionInFlight" class="w-full md:w-auto px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                     <span>✓ Finish & Next</span> 
                   </button>
                   
                   <button *ngIf="editingVisitId" (click)="saveVisit()" [disabled]="!visitForm.valid" class="w-full md:w-auto px-6 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-sm">
                      Update Record
                   </button>
               </ng-container>

                <ng-template #noConsult>
                    <div class="text-sm text-gray-400 italic">Read-only mode</div>
                </ng-template>
             </div>
         </div>

      </div>

      <!-- Vitals Modal -->
      <app-vitals-form *ngIf="showVitalsModal"
          [patientId]="patientId"
          [visitId]="encounterId"
          [existingVitals]="patientVitals"
          (closeDialog)="closeVitalsModal()"
          (vitalsSaved)="onVitalsSaved($event)">
      </app-vitals-form>

      <!-- Allergy Conflict Modal -->
      <div *ngIf="showAllergyOverrideModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-red-200">
            <div class="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-xl">⚠️</span>
                    <h3 class="text-base font-bold text-red-800">Prescribing Allergy Alert</h3>
                </div>
                <button (click)="cancelAllergyOverride()" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div class="p-6 space-y-4">
                <p class="text-sm text-gray-700">
                    One or more prescribed medications conflict with the patient's recorded allergies:
                </p>
                <div class="space-y-2">
                    <div *ngFor="let conflict of activeAllergyConflicts" class="p-3 bg-red-50/70 border border-red-200 rounded-lg text-xs space-y-1">
                        <div class="font-bold text-red-900 flex justify-between">
                            <span>Prescribed: {{ conflict.medicine }}</span>
                            <span class="uppercase px-1.5 py-0.5 rounded bg-red-200 text-red-800 text-[10px]">{{ conflict.criticality }} risk</span>
                        </div>
                        <div class="text-red-700">Patient Allergy: <b>{{ conflict.substance }}</b></div>
                        <div *ngIf="conflict.reaction" class="text-red-600 italic">Reaction: {{ conflict.reaction }}</div>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Clinical Override Rationale <span class="text-red-500">*</span>
                    </label>
                    <textarea [(ngModel)]="overrideReasonInput" rows="3" 
                              placeholder="e.g. Desensitization complete, patient tolerated previously, or emergency benefit outweighs risk..."
                              class="w-full border p-2.5 rounded text-sm outline-none focus:ring-2 focus:ring-red-500 border-gray-300"></textarea>
                    <p class="text-[11px] text-gray-500 mt-1">An override reason is required by clinical safety policy to prescribe this medication.</p>
                </div>
            </div>
            <div class="bg-gray-50 border-t px-6 py-3 flex justify-between items-center">
                <button (click)="cancelAllergyOverride()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded border bg-white">
                    Cancel & Modify Rx
                </button>
                <button (click)="confirmAllergyOverride()" 
                        [disabled]="!overrideReasonInput.trim()"
                        class="px-5 py-2 text-sm bg-red-600 text-white font-bold rounded hover:bg-red-700 disabled:opacity-50 shadow-sm transition">
                    Acknowledge & Override
                </button>
            </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class VisitComponent implements OnInit {
  patientId!: number;
  patient: any;
  history: Visit[] = [];
  visitForm: FormGroup;
  editingVisitId: number | null = null;
  encounterId: number | null = null;
  isConsulting = false;
  activeEncounterReadOnly = false;
  consultationLoadError: string | null = null;
  actionInFlight = false;
  chartWritable = false;
  private consultationStartPending = false;
  private startRequestId: string | null = null;
  private nextStartRequestId: string | null = null;
  currentUser: any;
  patientVitals: any;
  showMobileHistory = false;
  showVitalsModal = false;

  // Clinical Safety Context & Allergy Conflict Modal
  patientSafetyContext: any = null;
  showAllergyOverrideModal = false;
  activeAllergyConflicts: Array<{ medicine: string; substance: string; criticality: string; reaction?: string }> = [];
  overrideReasonInput = '';
  pendingActionAfterOverride: (() => Promise<boolean>) | null = null;

  currentPrescription: any[] = [];
  private conditionPresetGeneration = 0;
  viewMode = false;
  viewVisitId: number | null = null;
  viewedVisit: Visit | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private ngZone: NgZone,
    private pdfService: PdfService,
    private dataService: DataService,
    private authService: AuthService
  ) {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || {};
    if (state['isConsulting']) {
      this.isConsulting = true;
    }
    if (state['encounterId']) {
      this.encounterId = Number(state['encounterId']);
    }
    this.applyViewIntent(state);

    this.visitForm = this.fb.group({
      symptoms: [''],
      examination_notes: [''],
      diagnosis: [''],
      diagnosis_type: [''],
      prescription: [[]],
      amount_paid: [0],
      allergy_override_reason: ['']
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    combineLatest([this.route.params, this.route.queryParams]).subscribe(([params, queryParams]) => {
      this.patientId = +params['id'];
      this.applyViewIntent(queryParams);
      this.loadData();
    });
  }

  get isViewMode(): boolean {
    return this.viewMode && !this.isLiveConsultation;
  }

  get isLiveConsultation(): boolean {
    return this.chartWritable && this.isConsulting && this.encounterId != null && !this.activeEncounterReadOnly;
  }

  get canEditChart(): boolean {
    return this.chartWritable && !this.activeEncounterReadOnly && (this.isConsulting || this.editingVisitId != null);
  }

  private setChartWritable(writable: boolean) {
    this.chartWritable = writable;
    if (writable) {
      this.visitForm.enable();
    } else {
      this.visitForm.disable();
    }
  }

  editVisit(visit: any) {
    // Historical editing and active completion are deliberately separate modes.
    if (this.isViewMode) {
      this.viewVisitId = visit.id;
      this.patchVisitSnapshot(visit);
      this.setChartWritable(false);
      this.showMobileHistory = false;
      return;
    }
    if (this.isConsulting || this.encounterId || this.activeEncounterReadOnly) return;
    this.editingVisitId = visit.id;
    this.visitForm.patchValue({
      symptoms: visit.symptoms,
      examination_notes: visit.examination_notes,
      diagnosis: visit.diagnosis,
      diagnosis_type: visit.diagnosis_type,
      amount_paid: visit.amount_paid
    });

    if (visit.prescription && visit.prescription.length > 0) {
      this.currentPrescription = visit.prescription;
      this.visitForm.patchValue({ prescription: visit.prescription });
    } else {
      this.currentPrescription = [];
      this.visitForm.patchValue({ prescription: [] });
    }
    this.setChartWritable(true);

    // On mobile, close drawer after selection
    this.showMobileHistory = false;
  }

  resetForm() {
    this.editingVisitId = null;
    this.visitForm.reset({ amount_paid: 0, prescription: [] });
    this.currentPrescription = [];
    if (!this.isConsulting || this.activeEncounterReadOnly) {
      this.setChartWritable(false);
    }
  }

  async loadData() {
    this.consultationLoadError = null;
    try {
      this.setChartWritable(false);
      if (this.viewMode) {
        await this.loadFinishedVisitView();
        return;
      }
      let activeEncounterReadDenied = false;
      const activeEncounterRequest = this.dataService.invoke<any>('getActiveConsultation', this.patientId)
        .catch(error => {
          if (this.isAuthorizationError(error)) {
            activeEncounterReadDenied = true;
            return null;
          }
          throw error;
        });
      const [visits, allPatients, vitals, activeEncounter, safetyContext] = await Promise.all([
        this.dataService.invoke<any[]>('getVisits', this.patientId),
        this.dataService.invoke<any[]>('getPatients', ''),
        this.dataService.invoke<any>('getVitals', this.patientId),
        activeEncounterRequest,
        this.dataService.invoke<any>('getPatientSafetyContext', this.patientId).catch(() => null)
      ]);
      const p = allPatients.find((patient: any) => patient.id === this.patientId);
      let resumedEncounter: any = null;
      let resumeDenied = false;
      if (activeEncounter) {
        try {
          resumedEncounter = await this.dataService.invoke<any>('resumeConsultation', { encounterId: activeEncounter.id });
        } catch (e) {
          resumeDenied = this.isAuthorizationError(e);
          if (!resumeDenied) {
            this.consultationLoadError = 'Could not resume this consultation. Retry when the connection is available.';
          }
          console.warn(resumeDenied ? 'Active encounter is read-only for this user' : 'Could not resume active encounter', e);
        }
      }

      this.ngZone.run(() => {
        this.patient = p;
        this.history = visits.filter((visit: any) => visit.status !== 'in-progress');
        this.patientVitals = vitals;
        this.patientSafetyContext = safetyContext;

        if (resumedEncounter) {
          this.consultationStartPending = false;
          this.startRequestId = null;
          this.activeEncounterReadOnly = false;
          this.encounterId = resumedEncounter.id;
          this.isConsulting = true;
          this.editingVisitId = null;
          this.patchEncounter(resumedEncounter);
        } else if ((activeEncounter && resumeDenied) || activeEncounterReadDenied) {
          this.activeEncounterReadOnly = true;
          this.encounterId = null;
          this.isConsulting = false;
          this.editingVisitId = null;
        } else if (activeEncounter && this.consultationLoadError) {
          this.activeEncounterReadOnly = false;
          this.encounterId = null;
          this.isConsulting = false;
          this.editingVisitId = null;
        } else {
          this.activeEncounterReadOnly = false;
        }

        // Enable only after the exact linked queue entry has been reclaimed.
        if (resumedEncounter) {
          this.setChartWritable(true);

          // Auto-Fill Vitals into Objective if empty
          if (this.patientVitals && !this.visitForm.get('examination_notes')?.value) {
            const formatted = this.formatVitalsObjective(this.patientVitals);
            if (formatted) {
              this.visitForm.patchValue({ examination_notes: formatted });
            }
          }
        }
      });

      if (this.isConsulting && !activeEncounter && !activeEncounterReadDenied) {
        const queue = await this.dataService.invoke<any[]>('getQueue');
        const queueEntry = queue.find(item => item.patient_id === this.patientId && item.status === 'waiting');
        if (!queueEntry) throw new Error('Patient does not have a waiting queue entry');
        this.startRequestId ||= newRequestId();
        const encounter = await this.dataService.invoke<any>('beginConsultation', {
          patientId: this.patientId,
          queueEntryId: queueEntry.id,
          startRequestId: this.startRequestId
        });
        this.consultationStartPending = false;
        this.startRequestId = null;

        let linkedVitals: any = null;
        try {
          linkedVitals = await this.dataService.invoke<any>('getEncounterVitals', encounter.id);
        } catch { }

        this.ngZone.run(() => {
          this.encounterId = encounter.id;
          if (linkedVitals) {
            this.patientVitals = linkedVitals;
          }
          this.patchEncounter(encounter);
          this.setChartWritable(true);
        });
      } else if (!resumedEncounter && !this.editingVisitId) {
        this.setChartWritable(false);
      }
    } catch (e) {
      console.error(e);
      this.ngZone.run(() => {
        if (this.isConsulting && !this.encounterId) {
          this.consultationStartPending = true;
          this.isConsulting = false;
          this.consultationLoadError = 'Could not start this consultation. Open the patient from the queue or retry.';
        } else {
          this.consultationLoadError = 'Could not load the consultation. Retry when the connection is available.';
        }
        this.setChartWritable(false);
      });
    }
  }

  retryConsultationLoad(): Promise<void> {
    if (this.consultationStartPending) this.isConsulting = true;
    return this.loadData();
  }

  updatePrescription(items: any[]) {
    if (!this.canEditChart) return;
    this.visitForm.patchValue({ prescription: items });
  }

  searchConditions = (query: string) => this.dataService.invoke('searchConditions', query);

  createCondition = (name: string) => this.dataService.invoke('createCondition', { name });

  onDiagnosisTyped(name: string) {
    if (!this.canEditChart) return;
    this.conditionPresetGeneration += 1;
    this.visitForm.patchValue({ diagnosis: name });
    this.visitForm.get('diagnosis')?.markAsDirty?.();
  }

  async onConditionPicked(hit: { id: number; name: string }) {
    if (!this.canEditChart) return;
    this.visitForm.patchValue({ diagnosis: hit.name });
    const generation = ++this.conditionPresetGeneration;
    try {
      const presets = await this.dataService.invoke<any[]>('getConditionMedPresets', hit.id);
      if (generation !== this.conditionPresetGeneration) return;
      if (presets && presets.length > 0) {
        const lines = presets.map((line) => ({ ...line }));
        this.currentPrescription = lines;
        this.visitForm.patchValue({ prescription: lines });
      }
    } catch (e) {
      if (generation !== this.conditionPresetGeneration) return;
      console.warn('Could not apply condition presets', e);
    }
  }

  checkForAllergyConflicts(): Array<{ medicine: string; substance: string; criticality: string; reaction?: string }> {
    if (!this.patientSafetyContext?.active_allergies?.length) return [];
    const rxItems = (Array.isArray(this.currentPrescription) && this.currentPrescription.length > 0)
      ? this.currentPrescription
      : (this.visitForm.value?.prescription || (this.visitForm.get ? this.visitForm.get('prescription')?.value : []) || []);
    if (!Array.isArray(rxItems) || rxItems.length === 0) return [];

    const conflicts: Array<{ medicine: string; substance: string; criticality: string; reaction?: string }> = [];
    for (const item of rxItems) {
      const medName = String(item.medicine || '').toLowerCase().trim();
      if (!medName) continue;
      for (const allergy of this.patientSafetyContext.active_allergies) {
        const substance = String(allergy.substance || '').toLowerCase().trim();
        if (substance && (medName.includes(substance) || substance.includes(medName))) {
          conflicts.push({
            medicine: item.medicine,
            substance: allergy.substance,
            criticality: allergy.criticality || 'low',
            reaction: allergy.reaction
          });
        }
      }
    }
    return conflicts;
  }

  private verifyAllergySafety(continuation: () => Promise<boolean>): Promise<boolean> {
    const conflicts = this.checkForAllergyConflicts();
    const rawReason = this.visitForm.value?.allergy_override_reason || (this.visitForm.get ? this.visitForm.get('allergy_override_reason')?.value : '');
    const existingReason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (conflicts.length > 0 && !existingReason) {
      this.activeAllergyConflicts = conflicts;
      this.pendingActionAfterOverride = continuation;
      this.overrideReasonInput = '';
      this.showAllergyOverrideModal = true;
      return Promise.resolve(false);
    }
    return continuation();
  }

  confirmAllergyOverride() {
    if (!this.overrideReasonInput?.trim()) return;
    const reason = this.overrideReasonInput.trim();
    this.visitForm.patchValue({ allergy_override_reason: reason });
    if (this.visitForm.value) {
      this.visitForm.value.allergy_override_reason = reason;
    }
    this.showAllergyOverrideModal = false;
    if (this.pendingActionAfterOverride) {
      const action = this.pendingActionAfterOverride;
      this.pendingActionAfterOverride = null;
      action();
    }
  }

  cancelAllergyOverride() {
    this.showAllergyOverrideModal = false;
    this.pendingActionAfterOverride = null;
  }

  async saveVisit(): Promise<boolean> {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      return false;
    }

    return this.verifyAllergySafety(() => this.executeSaveVisit());
  }

  private async executeSaveVisit(): Promise<boolean> {
    const visitData = this.currentVisitData();

    try {
      if (this.editingVisitId) {
        await this.dataService.invoke('saveVisit', { id: this.editingVisitId, ...visitData });
      } else {
        if (!this.encounterId) throw new Error('No active encounter');
        await this.dataService.invoke('saveConsultationProgress', {
          encounterId: this.encounterId,
          visit: visitData
        });
      }
      this.ngZone.run(() => {
        if (this.editingVisitId) {
          this.resetForm();
        }
        // Reload history
        this.dataService.invoke<any[]>('getVisits', this.patientId)
          .then(visits => this.history = visits.filter(visit => visit.status !== 'in-progress'));
      });
      return true;
    } catch (e) {
      console.error('Save failed', e);
      return false;
    }
  }

  async deleteVisit() {
    if (!this.editingVisitId) return;
    if (confirm('Are you sure you want to delete this visit?')) {
      try {
        await this.dataService.invoke('deleteVisit', this.editingVisitId);
        this.ngZone.run(() => {
          this.resetForm();
          this.loadData();
        });
      } catch (e) {
        console.error(e);
        alert('Failed to delete visit');
      }
    }
  }

  async printPrescription() {
    try {
      await this.generateVisitPdf({ ...this.visitForm.value, date: new Date() });
    } catch (e) {
      console.error('Print failed', e);
    }
  }

  async downloadVisitPdf() {
    if (!this.viewedVisit) return;
    try {
      await this.generateVisitPdf(this.viewedVisit);
    } catch (e) {
      console.error('PDF download failed', e);
    }
  }

  // --- New Logic: Finish & Next ---

  async endConsult() {
    // Just end, go to queue (Old behavior)
    if (await this.completeConsult()) {
      this.router.navigate(['/queue']);
    }
  }

  async finishAndNext() {
    if (this.actionInFlight) return;
    this.actionInFlight = true;
    try {
      if (await this.completeConsult(false)) {
        this.nextStartRequestId ||= newRequestId();
        const nextEncounter = await this.dataService.invoke<any>('beginNextConsultation', {
          startRequestId: this.nextStartRequestId
        });
        this.nextStartRequestId = null;
        if (nextEncounter) {
          this.ngZone.run(() => {
            this.patientId = nextEncounter.patient_id;
            this.encounterId = nextEncounter.id;
            this.editingVisitId = null;
            this.visitForm.reset({ amount_paid: 0, prescription: [] });
            this.currentPrescription = [];
            this.isConsulting = true;
            this.router.navigate(['/visit', nextEncounter.patient_id], {
              state: { isConsulting: true, encounterId: nextEncounter.id }
            });
          });
        } else {
          this.isConsulting = false;
          alert('Queue is empty! Great job.');
          this.router.navigate(['/queue']);
        }
      }
    } catch (e) {
      console.error('Failed to start the next consultation', e);
      alert('The current consultation is finished, but the next patient could not be opened. Retry to resume safely.');
    } finally {
      this.actionInFlight = false;
    }
  }

  async completeConsult(manageActionLock = true): Promise<boolean> {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      alert('Please complete diagnosis.');
      return false;
    }

    if (!this.encounterId || (manageActionLock && this.actionInFlight)) return false;

    return this.verifyAllergySafety(() => this.executeCompleteConsult(manageActionLock));
  }

  private async executeCompleteConsult(manageActionLock: boolean): Promise<boolean> {
    try {
      if (manageActionLock) this.actionInFlight = true;
      await this.dataService.invoke('completeConsultation', {
        encounterId: this.encounterId,
        visit: this.currentVisitData()
      });
      if (manageActionLock) this.isConsulting = false;
      return true;
    } catch (e) {
      console.error('Failed to end consult', e);
      alert('Failed to finish consultation. Your encounter remains open.');
      return false;
    } finally {
      if (manageActionLock) this.actionInFlight = false;
    }
  }

  copyLastVisit() {
    if (!this.canEditChart || this.history.length === 0) return;
    this.conditionPresetGeneration += 1;
    const last = this.history[0];
    this.visitForm.patchValue({
      diagnosis: last.diagnosis,
      diagnosis_type: last.diagnosis_type,
      prescription: last.prescription
    });
    this.currentPrescription = last.prescription || [];
  }

  async postponeConsult() {
    if (!this.encounterId || this.actionInFlight) return;
    try {
      this.actionInFlight = true;
      await this.dataService.invoke('postponeConsultation', {
        encounterId: this.encounterId,
        visit: this.visitForm.valid ? this.currentVisitData() : undefined
      });
      this.router.navigate(['/queue']);
    } catch (e) {
      console.error(e);
      alert('Failed to postpone consultation.');
    } finally {
      this.actionInFlight = false;
    }
  }

  private currentVisitData() {
    return { ...this.visitForm.value };
  }

  private applyViewIntent(source: Record<string, any> | null | undefined) {
    const isViewMode = source?.['mode'] === 'view';
    const visitId = source?.['visitId'];
    this.viewMode = isViewMode;
    this.viewVisitId = isViewMode && visitId != null && visitId !== ''
      ? Number(visitId)
      : null;
    if (!isViewMode) this.viewedVisit = null;
  }

  private async loadFinishedVisitView() {
    const [visits, allPatients, vitals, safetyContext] = await Promise.all([
      this.dataService.invoke<any[]>('getVisits', this.patientId),
      this.dataService.invoke<any[]>('getPatients', ''),
      this.dataService.invoke<any>('getVitals', this.patientId),
      this.dataService.invoke<any>('getPatientSafetyContext', this.patientId).catch(() => null)
    ]);
    const patient = allPatients.find((item: any) => item.id === this.patientId);
    const finished = (visits || []).filter((visit: any) => visit.status !== 'in-progress');
    const target = this.viewVisitId != null
      ? finished.find((visit: any) => Number(visit.id) === Number(this.viewVisitId))
      : undefined;

    this.ngZone.run(() => {
      this.patient = patient;
      this.history = finished;
      this.patientVitals = vitals;
      this.patientSafetyContext = safetyContext;
      this.activeEncounterReadOnly = false;
      this.encounterId = null;
      this.isConsulting = false;
      this.editingVisitId = null;
      this.viewedVisit = target || null;
      if (target) {
        this.patchVisitSnapshot(target);
      } else if (this.viewVisitId != null) {
        this.consultationLoadError = 'Could not load this visit.';
      }
      this.setChartWritable(false);
    });
  }

  private async generateVisitPdf(visit: any) {
    const settings = await this.dataService.invoke<any>('getPublicSettings');
    const currentUser = this.authService.getUser();
    const doctor = {
      name: currentUser?.name || settings?.doctor_name || 'Doctor',
      specialty: currentUser?.specialty || 'General',
      license_number: currentUser?.license_number || settings?.license_key || ''
    };
    await this.pdfService.generatePrescription(
      { ...visit, date: visit.date || new Date() },
      this.patient,
      doctor
    );
  }

  private patchVisitSnapshot(visit: any) {
    this.viewedVisit = visit;
    this.visitForm.patchValue({
      symptoms: visit.symptoms || '',
      examination_notes: visit.examination_notes || '',
      diagnosis: visit.diagnosis || '',
      diagnosis_type: visit.diagnosis_type || '',
      prescription: visit.prescription || [],
      amount_paid: visit.amount_paid || 0,
      allergy_override_reason: visit.allergy_override_reason || ''
    });
    this.currentPrescription = visit.prescription || [];
  }

  private patchEncounter(encounter: any) {
    this.visitForm.patchValue({
      symptoms: encounter.symptoms || '',
      examination_notes: encounter.examination_notes || '',
      diagnosis: encounter.diagnosis || '',
      diagnosis_type: encounter.diagnosis_type || '',
      prescription: encounter.prescription || [],
      amount_paid: encounter.amount_paid || 0,
      allergy_override_reason: encounter.allergy_override_reason || ''
    });
    this.currentPrescription = encounter.prescription || [];
  }

  private isAuthorizationError(error: unknown): boolean {
    const message = String((error as Error)?.message ?? error ?? '');
    return /responsible practitioner|forbidden|unauthorized/i.test(message);
  }

  openVitalsModal(): void {
    if (!this.canEditChart) return;
    this.showVitalsModal = true;
  }

  closeVitalsModal(): void {
    this.showVitalsModal = false;
  }

  onVitalsSaved(vitals: any): void {
    this.patientVitals = vitals;
    this.closeVitalsModal();
  }

  hasBp(v: any): boolean {
    return Boolean(v && this.isVitalPresent(v.systolic_bp) && this.isVitalPresent(v.diastolic_bp));
  }

  isVitalPresent(val: unknown): boolean {
    return val !== null && val !== undefined && val !== '' && !Number.isNaN(val);
  }

  hasVitalsToDisplay(v: any): boolean {
    if (!v) return false;
    return this.hasBp(v) ||
      this.isVitalPresent(v.pulse) ||
      this.isVitalPresent(v.temperature) ||
      this.isVitalPresent(v.spo2) ||
      this.isVitalPresent(v.weight) ||
      this.isVitalPresent(v.height);
  }

  formatVitalsObjective(v: any): string {
    if (!v) return '';
    const parts: string[] = [];
    if (this.hasBp(v)) parts.push(`BP: ${v.systolic_bp}/${v.diastolic_bp} mmHg`);
    if (this.isVitalPresent(v.pulse)) parts.push(`Pulse: ${v.pulse} bpm`);
    if (this.isVitalPresent(v.temperature)) parts.push(`Temp: ${v.temperature} °F`);
    if (this.isVitalPresent(v.spo2)) parts.push(`SpO2: ${v.spo2}%`);
    if (this.isVitalPresent(v.respiratory_rate)) parts.push(`RR: ${v.respiratory_rate} bpm`);
    if (this.isVitalPresent(v.weight)) parts.push(`Weight: ${v.weight} kg`);
    if (this.isVitalPresent(v.height)) parts.push(`Height: ${v.height} cm`);
    if (this.isVitalPresent(v.bmi)) parts.push(`BMI: ${v.bmi}`);
    return parts.join('\n');
  }

  goBack() {
    this.router.navigate(['/patients']);
  }
}
