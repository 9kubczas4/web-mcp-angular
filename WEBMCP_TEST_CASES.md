# WebMCP — Przypadki testowe dla demo

Wszystkie wywołania wykonujesz przez **Chrome DevTools → zakładka „Model Context"** (rozszerzenie WebMCP DevTools) lub bezpośrednio przez `navigator.modelContext` w konsoli przeglądarki.

---

## Narzędzia i ich zasięg

| Narzędzie           | Zasięg                       | Aktywne na trasie  |
| ------------------- | ---------------------------- | ------------------ |
| `searchProducts`    | Global (root injector)       | wszędzie           |
| `getCartSummary`    | Service-scoped (CartService) | wszędzie           |
| `addToCart`         | Service-scoped (CartService) | wszędzie           |
| `filterProducts`    | Route-scoped                 | tylko `/products`  |
| `exportReport`      | Route-scoped                 | tylko `/dashboard` |
| `submitContactForm` | Form tool                    | tylko `/contact`   |

---

## 1. Global tool — `searchProducts`

Narzędzie jest zarejestrowane w root injectorze, więc działa na każdej trasie.

### TC-01 — Wyszukiwanie po słowie kluczowym

**Trasa:** dowolna (np. `/`)  
**Wywołanie:**

```json
{
  "name": "searchProducts",
  "arguments": { "query": "headphones" }
}
```

**Oczekiwany wynik:**

```json
{
  "status": "success",
  "payload": {
    "matches": [
      { "id": "aud-001", "name": "Studio Over-Ear Headphones", ... }
    ]
  }
}
```

### TC-02 — Puste zapytanie zwraca cały katalog

**Wywołanie:**

```json
{ "name": "searchProducts", "arguments": { "query": "" } }
```

**Oczekiwany wynik:** `status: "success"`, `matches` zawiera wszystkie 8 produktów.

### TC-03 — Brak wymaganych pól (błąd walidacji)

**Wywołanie:**

```json
{ "name": "searchProducts", "arguments": {} }
```

**Oczekiwany wynik:** `status: "error"`, `payload.code: "validation"`.

---

## 2. Service-scoped tools — `getCartSummary` i `addToCart`

Narzędzia żyją razem z `CartService` (root injector), więc są dostępne na każdej trasie.

### TC-04 — Pusty koszyk

**Trasa:** dowolna  
**Wywołanie:**

```json
{ "name": "getCartSummary", "arguments": {} }
```

**Oczekiwany wynik:**

```json
{
  "status": "success",
  "payload": { "items": [], "itemCount": 0, "total": 0 }
}
```

### TC-05 — Dodanie produktu do koszyka

**Wywołanie:**

```json
{
  "name": "addToCart",
  "arguments": { "productId": "aud-001", "quantity": 2 }
}
```

**Oczekiwany wynik:** `status: "success"`, koszyk zawiera 1 linię z `productId: "aud-001"`, `quantity: 2`, `total: 398`.

### TC-06 — Ponowne dodanie tego samego produktu (akumulacja ilości)

Po TC-05 wywołaj ponownie:

```json
{
  "name": "addToCart",
  "arguments": { "productId": "aud-001", "quantity": 1 }
}
```

**Oczekiwany wynik:** ta sama linia, `quantity: 3`, `total: 597`.

### TC-07 — Nieistniejący produkt

```json
{
  "name": "addToCart",
  "arguments": { "productId": "xyz-999", "quantity": 1 }
}
```

**Oczekiwany wynik:** `status: "error"`, `payload.code: "not_found"`.

### TC-08 — Nieprawidłowa ilość (quantity = 0)

```json
{
  "name": "addToCart",
  "arguments": { "productId": "aud-001", "quantity": 0 }
}
```

**Oczekiwany wynik:** `status: "error"`, `payload.code: "validation"` (minimum: 1).

### TC-09 — Spójność stanu między narzędziem a UI

1. Wywołaj `addToCart` z `productId: "wea-001"`, `quantity: 1`.
2. Przejdź do `/cart` w przeglądarce.
3. **Oczekiwany wynik:** UI pokazuje „Trail Runner Smartwatch" w koszyku — stan jest wspólny.

---

## 3. Route-scoped tool — `filterProducts`

Narzędzie jest aktywne **tylko gdy jesteś na trasie `/products`**. To kluczowy scenariusz do zademonstrowania auto-cleanup.

### TC-10 — Narzędzie niedostępne poza trasą

**Trasa:** `/` lub `/dashboard`  
**Wywołanie:** `filterProducts` z dowolnymi argumentami.  
**Oczekiwany wynik:** narzędzie nie pojawia się na liście dostępnych narzędzi w DevTools.

### TC-11 — Narzędzie dostępne po nawigacji do `/products`

1. Przejdź do `/products`.
2. Sprawdź listę narzędzi w DevTools.
3. **Oczekiwany wynik:** `filterProducts` jest widoczne.

### TC-12 — Filtrowanie po kategorii

**Trasa:** `/products`  
**Wywołanie:**

```json
{
  "name": "filterProducts",
  "arguments": { "category": "audio" }
}
```

**Oczekiwany wynik:** `matches` zawiera tylko `aud-001` i `aud-002`.

### TC-13 — Filtrowanie po maksymalnej cenie

```json
{
  "name": "filterProducts",
  "arguments": { "maxPrice": 100 }
}
```

**Oczekiwany wynik:** produkty z ceną ≤ 100 (`aud-002` za 79 zł, `hom-001` za 39 zł).

### TC-14 — Filtrowanie po kategorii i cenie jednocześnie

```json
{
  "name": "filterProducts",
  "arguments": { "category": "wearable", "maxPrice": 300 }
}
```

**Oczekiwany wynik:** tylko `wea-001` (249), bez `wea-002` (329).

### TC-15 — Nieprawidłowa kategoria

```json
{
  "name": "filterProducts",
  "arguments": { "category": "furniture" }
}
```

**Oczekiwany wynik:** `status: "error"`, `payload.code: "validation"`.

### TC-16 — Auto-cleanup po opuszczeniu trasy

1. Będąc na `/products`, potwierdź że `filterProducts` jest dostępne.
2. Przejdź do `/dashboard`.
3. **Oczekiwany wynik:** `filterProducts` znika z listy narzędzi — `withExperimentalAutoCleanupInjectors()` wyrejestrował je automatycznie.

---

## 4. Route-scoped tool — `exportReport`

### TC-17 — Eksport do JSON

**Trasa:** `/dashboard`  
**Wywołanie:**

```json
{
  "name": "exportReport",
  "arguments": { "format": "json" }
}
```

**Oczekiwany wynik:**

```json
{
  "status": "success",
  "payload": { "format": "json", "generatedAt": "<ISO timestamp>", "rows": 42 }
}
```

### TC-18 — Eksport do CSV i PDF

Powtórz TC-17 z `"format": "csv"` i `"format": "pdf"`. Oba powinny zwrócić `status: "success"`.

### TC-19 — Nieprawidłowy format

```json
{
  "name": "exportReport",
  "arguments": { "format": "xlsx" }
}
```

**Oczekiwany wynik:** `status: "error"`, `payload.code: "validation"`.

### TC-20 — Spójność z przyciskiem UI

1. Kliknij przycisk „Export" w UI na `/dashboard` (format: json).
2. Wywołaj `exportReport` przez narzędzie z tym samym formatem.
3. **Oczekiwany wynik:** oba zwracają identyczną strukturę odpowiedzi (różni się tylko `generatedAt`).

---

## 5. Form tool — `submitContactForm`

Narzędzie jest produkowane przez `form()` z opcją `experimentalWebMcpTool`. Walidacja jest identyczna dla wywołania przez UI i przez narzędzie.

### TC-21 — Poprawne zgłoszenie

**Trasa:** `/contact`  
**Wywołanie:**

```json
{
  "name": "submitContactForm",
  "arguments": {
    "name": "Jan Kowalski",
    "email": "jan@example.com",
    "topic": "support",
    "message": "Mam pytanie dotyczące zamówienia numer 12345."
  }
}
```

**Oczekiwany wynik:**

```json
{
  "status": "success",
  "payload": { "submitted": true, "ticketId": "TICKET-0001" }
}
```

### TC-22 — Brakujące pole `name`

```json
{
  "name": "submitContactForm",
  "arguments": {
    "email": "jan@example.com",
    "topic": "support",
    "message": "Wiadomość testowa z wystarczającą długością."
  }
}
```

**Oczekiwany wynik:** `status: "error"`, `payload.code: "validation"`, błąd dla pola `name`.

### TC-23 — Nieprawidłowy adres e-mail

```json
{
  "name": "submitContactForm",
  "arguments": {
    "name": "Jan",
    "email": "to-nie-jest-email",
    "topic": "billing",
    "message": "Wiadomość testowa z wystarczającą długością."
  }
}
```

**Oczekiwany wynik:** `status: "error"`, błąd walidacji dla pola `email`.

### TC-24 — Wiadomość za krótka (< 10 znaków)

```json
{
  "name": "submitContactForm",
  "arguments": {
    "name": "Jan",
    "email": "jan@example.com",
    "topic": "other",
    "message": "Krótko"
  }
}
```

**Oczekiwany wynik:** `status: "error"`, błąd `minLength` dla pola `message`.

### TC-25 — Nieprawidłowy temat

```json
{
  "name": "submitContactForm",
  "arguments": {
    "name": "Jan",
    "email": "jan@example.com",
    "topic": "nieznany-temat",
    "message": "Wiadomość testowa z wystarczającą długością."
  }
}
```

**Oczekiwany wynik:** `status: "error"`, błąd walidacji dla pola `topic`.

### TC-26 — Spójność z formularzem UI

1. Wypełnij formularz w UI na `/contact` poprawnymi danymi i kliknij Submit.
2. Wywołaj `submitContactForm` przez narzędzie z tymi samymi danymi.
3. **Oczekiwany wynik:** oba zwracają `status: "success"` z kolejnymi `ticketId` (TICKET-0001, TICKET-0002).

---

## 6. Scenariusze end-to-end (łączące kilka narzędzi)

### TC-27 — Kompletny przepływ zakupowy przez narzędzia

1. `searchProducts` z `query: "speaker"` → znajdź `aud-002`.
2. `addToCart` z `productId: "aud-002"`, `quantity: 1`.
3. `filterProducts` (na `/products`) z `category: "office"` → znajdź `off-002`.
4. `addToCart` z `productId: "off-002"`, `quantity: 2`.
5. `getCartSummary` → sprawdź `itemCount: 3`, `total: 417` (79 + 2×169).

### TC-28 — Weryfikacja izolacji zasięgów

1. Przejdź do `/products` — `filterProducts` dostępne, `exportReport` niedostępne.
2. Przejdź do `/dashboard` — `exportReport` dostępne, `filterProducts` niedostępne.
3. Przejdź do `/` — żadne z route-scoped narzędzi niedostępne.
4. `searchProducts` i `getCartSummary` dostępne na każdej trasie.

---

## Dostępne wartości referencyjne

**Kategorie produktów:** `audio` | `wearable` | `home` | `office`  
**Formaty eksportu:** `pdf` | `csv` | `json`  
**Tematy kontaktowe:** sprawdź w `contact-form.model.ts` (np. `support`, `billing`, `other`)

**ID produktów z katalogu:**

| ID        | Nazwa                      | Kategoria | Cena |
| --------- | -------------------------- | --------- | ---- |
| `aud-001` | Studio Over-Ear Headphones | audio     | 199  |
| `aud-002` | Pocket Bluetooth Speaker   | audio     | 79   |
| `wea-001` | Trail Runner Smartwatch    | wearable  | 249  |
| `wea-002` | Sleep Tracking Ring        | wearable  | 329  |
| `hom-001` | Smart Plant Sensor         | home      | 39   |
| `hom-002` | Mesh Wi-Fi Node            | home      | 129  |
| `off-001` | Standing Desk Converter    | office    | 219  |
| `off-002` | USB-C Docking Station      | office    | 169  |
