/*
  Diagnóstico de rendimiento — eventos remotos de Firebase.
  No es una prueba automatizada (no tiene aserciones): imprime tiempos
  para ver el efecto de los atajos de comparación (_iguales / _localLimpio)
  y del repintado agrupado (UI.programarRender).

  Uso:  node tests/perf-remoto.cjs
*/
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', '02-data-engine.js'), 'utf8');

const GRUPOS = 25;
const POR_GRUPO = 40;

function makeDb() {
  const db = { version: '1.0', lastUpdated: new Date().toISOString(), grupos: [], equipos: [] };
  for (let g = 0; g < GRUPOS; g++) {
    const estudiantes = [];
    for (let s = 0; s < POR_GRUPO; s++) {
      const evaluacionesPorModulo = {};
      ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].forEach(m => {
        evaluacionesPorModulo[m] = { notas: { 'UD 1': 70 + (s % 30), 'UD 2': 65 + (s % 30), Examen: 60 + (s % 30), Total: 70 } };
      });
      estudiantes.push({
        id: `s${g}-${s}`, nombres: `Nombres ${s}`, apellidos: `Apellidos ${s}`,
        correo: `alumno${g}${s}@correo.com`, telefono: '8888-8888', estado: 'Activo',
        evaluacionesPorModulo
      });
    }
    db.grupos.push({
      id: `g${g}`, nombre: `Grupo ${g} - Traso Vespertino`,
      carrera: 'Tecnología en Informática', turno: 'Vespertino', docenteGuia: 'Docente',
      estudiantes
    });
  }
  return db;
}

let renderDirecto = 0;
let renderDiferido = 0;
const context = {
  window: { FirebaseServices: { database: { ref: () => ({ child: () => ({}) }) } } },
  AuthManager: { user: { uid: 'u1' }, profile: { role: 'admin', centerId: 'c1' } },
  UI: {
    showToast() {},
    renderCurrentModule() { renderDirecto++; },
    programarRender() { renderDiferido++; }
  },
  document: { getElementById: id => (id === 'workspace' ? { children: { length: 1 } } : null) },
  console, Date, JSON, Set, Map, Object, Array, String, Error, Promise, setTimeout, clearTimeout
};
vm.runInNewContext(`${source}\nglobalThis.engine = DataEngine;`, context);
const engine = context.engine;

engine.db = makeDb();
engine._keyEncodingVersion = 1;
engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));
const db = engine.db;
const ms = valor => `${valor.toFixed(1)} ms`;

const snapshot = (key, val) => ({ key, val: () => structuredClone(val) });

console.log(`Base sintética: ${GRUPOS} grupos × ${POR_GRUPO} estudiantes`);

// 1) Ráfaga inicial: Firebase emite un child_added por cada grupo
const serial = engine._serializeDatabase(engine.db);
renderDirecto = 0; renderDiferido = 0;
let inicio = performance.now();
db.grupos.forEach(g => engine._applyRemoteRecord('grupos', snapshot(g.id, serial.grupos[g.id]), false));
let total = performance.now() - inicio;
console.log(`1) ráfaga de ${GRUPOS} child_added (arranque): ${ms(total)}  ·  re-renders: ${renderDirecto + renderDiferido} (directos ${renderDirecto})`);

// 2) Cambio real de UN estudiante, 20 veces
renderDirecto = 0; renderDiferido = 0;
const cambio = structuredClone(db.grupos[0]);
cambio.estudiantes[0].nombres = 'Nombre Nuevo';
inicio = performance.now();
for (let i = 0; i < 20; i++) engine._applyRemoteRecord('grupos', snapshot('g0', cambio), false);
total = performance.now() - inicio;
console.log(`2) 20 child_changed reales: ${ms(total)}  ·  re-renders: ${renderDirecto + renderDiferido} (directos ${renderDirecto})`);

// 3) Orden y ajustes que no cambian nada
renderDirecto = 0; renderDiferido = 0;
inicio = performance.now();
for (let i = 0; i < 10; i++) engine._applyRemoteOrder('grupos', db.grupos.map(g => g.id));
for (let i = 0; i < 10; i++) engine._applyRemoteSettings('cuadernoConfig', { formato: 'xlsx' });
total = performance.now() - inicio;
console.log(`3) 10 orden + 10 ajustes sin cambio: ${ms(total)}  ·  re-renders: ${renderDirecto + renderDiferido}`);

// 4) Costo del chequeo de estado local completo
inicio = performance.now();
for (let i = 0; i < 10; i++) engine._localLimpio();
total = performance.now() - inicio;
console.log(`4) 10 chequeos de estado local: ${ms(total)}`);

// 5) Guardado (comparación por registro + transacciones)
const remoto = structuredClone(engine._syncSnapshot);
let transacciones = 0;
context.window.FirebaseServices.database.ref = () => ({
  child: sub => ({
    async transaction(fn) {
      const partes = sub.split('/');
      const raiz = partes.length === 2 ? remoto[partes[0]] : remoto;
      const actual = partes.length === 2 ? (raiz?.[partes[1]] ?? null) : (remoto[sub] ?? null);
      const next = fn(structuredClone(actual));
      if (next === undefined) return { committed: false };
      transacciones++;
      if (partes.length === 2) { remoto[partes[0]] = remoto[partes[0]] || {}; remoto[partes[0]][partes[1]] = next; }
      else remoto[sub] = next;
      return { committed: true };
    }
  }),
  async update(valores) { Object.assign(remoto, valores); }
});
db.grupos[0].estudiantes[0].apellidos = 'Apellido Editado';
renderDirecto = 0; renderDiferido = 0;
inicio = performance.now();
engine.save().then(() => {
  console.log(`5) save() con un grupo modificado: ${ms(performance.now() - inicio)}  ·  transacciones: ${transacciones}`);
}).catch(error => console.log(`5) save() falló: ${error.message}`));
