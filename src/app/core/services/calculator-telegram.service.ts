import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { CalculatorTelegramPayload } from '../models/calculator.models';

@Injectable({ providedIn: 'root' })
export class CalculatorTelegramService {
  private readonly http = inject(HttpClient);

  sendLead(payload: CalculatorTelegramPayload): Observable<boolean> {
    return this.http.post<{ ok: boolean }>('/api/calculator/telegram', payload).pipe(
      map((response) => response.ok === true),
      catchError(() => of(false)),
    );
  }
}
