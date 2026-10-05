'use strict';
    const DataEngine = {
      db: { version: "1.0", lastUpdated: new Date().toISOString(), grupos: [], equipos: [] },
      _syncSnapshot: null,
      _keyEncodingVersion: 0,
      _listeners: [],
      _migrationNotice: '',
      centerId: null,

      _centerDataReference(database = window.FirebaseServices.database) {
        const centerId = AuthManager.activeCenterId || AuthManager.profile?.centerId;
        if (!centerId || !/^[A-Za-z0-9_-]{1,80}$/.test(centerId)) {
          throw new Error('Tu cuenta no tiene un centro tecnológico válido. Solicita al administrador que asigne uno.');
        }
        this.centerId = centerId;
        return database.ref(`centers/${centerId}/appData`);
      },

      async prepareAccount(profile, user, database = window.FirebaseServices.database) {
        if (profile.centerId) {
          if (!/^[A-Za-z0-9_-]{1,80}$/.test(profile.centerId)) {
            throw new Error('El centro asignado a tu cuenta tiene un identificador no válido.');
          }
          const centerSnapshot = await database.ref(`centers/${profile.centerId}/metadata`).once('value');
          const center = centerSnapshot.val();
          if (!center || center.active === false) {
            throw new Error('El centro asignado no existe o está desactivado. Contacta al administrador.');
          }
          profile.centerName = center.name;
          return profile;
        }
        if (profile.role !== 'admin') {
          throw new Error('Tu cuenta todavía no tiene un centro tecnológico asignado. Contacta al administrador.');
        }

        const centerId = 'ct-ariel-darce';
        const centerReference = database.ref(`centers/${centerId}`);
        const legacyReference = database.ref('appData');
        const [centerSnapshot, legacySnapshot] = await Promise.all([
          centerReference.once('value'),
          legacyReference.once('value')
        ]);
        const existingCenter = centerSnapshot.val();
        const legacyData = legacySnapshot.val();
        if (!existingCenter?.metadata) {
          await centerReference.child('metadata').set({
            id: centerId,
            name: 'Centro Tecnológico Ariel Darce',
            active: true,
            createdAt: new Date().toISOString()
          });
        }
        const appDataReference = centerReference.child('appData');
        const appDataSnapshot = await appDataReference.once('value');
        if (!appDataSnapshot.exists()) {
          if (legacyData) {
            await appDataReference.set(legacyData);
            const copiedSnapshot = await appDataReference.once('value');
            if (this._stable(copiedSnapshot.val()) !== this._stable(legacyData)) {
              throw new Error('No se pudo verificar la migración de los datos existentes al Centro Tecnológico Ariel Darce.');
            }
            this._migrationNotice = 'Los datos existentes se asignaron al Centro Tecnológico Ariel Darce sin borrar la copia anterior.';
          } else {
            await appDataReference.set({
              ...this._serializeDatabase({ version: '1.0', grupos: [], equipos: [] }),
              updatedBy: user.uid
            });
          }
        }
        await database.ref(`users/${user.uid}`).update({ centerId });
        profile.centerId = centerId;
        profile.centerName = 'Centro Tecnológico Ariel Darce';
        return profile;
      },

      async init() {
        const { database } = window.FirebaseServices || {};
        if (!database || !AuthManager.user) {
          throw new Error('La sesión de Firebase no está activa.');
        }

        const reference = this._centerDataReference(database);
        const snapshot = await reference.once('value');
        const remoteData = snapshot.val();
        if (!remoteData) {
          if (AuthManager.profile?.role !== 'admin') {
            throw new Error('La base compartida aún no tiene datos. Solicita al administrador que importe la base inicial de grupos.');
          }
          this.db = { version: '1.0', lastUpdated: new Date().toISOString(), grupos: [], equipos: [] };
          const localData = localStorage.getItem('TIC_DASHBOARD_DB');
          if (localData && window.confirm('Se encontró una base guardada en este navegador. ¿Quieres migrarla ahora a Firebase como base compartida?')) {
            const legacyDatabase = JSON.parse(localData);
            if (!legacyDatabase || !Array.isArray(legacyDatabase.grupos)) {
              throw new Error('La base local no tiene un formato válido. Impórtala como JSON desde la herramienta superior.');
            }
            this.db = legacyDatabase;
            this._migrarEsquema();
            this._migrationNotice = 'Se migraron a Firebase los datos guardados anteriormente en este navegador.';
          }
          const initialData = this._serializeDatabase(this.db);
          await reference.set({ ...initialData, updatedBy: AuthManager.user.uid });
          this._syncSnapshot = this._clone(initialData);
          this._keyEncodingVersion = 1;
          if (this._migrationNotice) {
            try {
              localStorage.removeItem('TIC_DASHBOARD_DB');
            } catch (error) {
              console.error('No se pudo retirar la copia local ya migrada:', error);
              this._migrationNotice += ' La copia local no pudo eliminarse automáticamente.';
            }
          }
        } else {
          this.db = this._deserializeDatabase(remoteData);
          this._migrarEsquema();
          const normalized = this._serializeDatabase(this.db);
          const usesLegacyFormat = Array.isArray(remoteData.grupos) ||
            Array.isArray(remoteData.equipos) ||
            !Array.isArray(remoteData.gruposOrden) ||
            !Array.isArray(remoteData.equiposOrden) ||
            remoteData.firebaseKeyEncoding !== 1;
          if (usesLegacyFormat) {
            if (AuthManager.profile?.role !== 'admin') {
              throw new Error('La base necesita una migración inicial. Solicita al administrador que inicie sesión primero.');
            }
            await reference.set({ ...normalized, updatedBy: AuthManager.user.uid });
          }
          this._syncSnapshot = this._clone(normalized);
          this._keyEncodingVersion = 1;
        }

        this._subscribeToChanges(database);
      },

      _clone(value) {
        return JSON.parse(JSON.stringify(value));
      },

      _encodeFirebaseKeys(value) {
        if (Array.isArray(value)) return value.map(item => this._encodeFirebaseKeys(item));
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([key, item]) => {
          const storedKey = key.length === 0 || /[.#$\[\]/\u0000-\u001F\u007F]/.test(key) || key.startsWith('~')
            ? `~${encodeURIComponent(key).replace(/[.!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`
            : key;
          return [storedKey, this._encodeFirebaseKeys(item)];
        }));
      },

      _decodeFirebaseKeys(value) {
        if (Array.isArray(value)) return value.map(item => this._decodeFirebaseKeys(item));
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([key, item]) => {
          let decodedKey = key;
          if (key.startsWith('~')) {
            try {
              decodedKey = decodeURIComponent(key.slice(1));
            } catch (error) {
              throw new Error(`No se pudo decodificar una clave almacenada de Firebase: ${error.message}`);
            }
          }
          return [decodedKey, this._decodeFirebaseKeys(item)];
        }));
      },

      _toRecordMap(records, collectionName) {
        const map = Object.create(null);
        (records || []).forEach(record => {
          if (!record || record.id === undefined || record.id === null) {
            throw new Error(`No se puede guardar ${collectionName}: falta el identificador de un registro.`);
          }
          const key = String(record.id);
          if (/[.#$\[\]/]/.test(key)) {
            throw new Error(`El identificador "${key}" no es válido para Firebase Realtime Database.`);
          }
          const storedRecord = this._clone(record);
          map[key] = storedRecord;
        });
        return map;
      },

      _serializeDatabase(database) {
        const extraData = { ...database };
        delete extraData.grupos;
        delete extraData.equipos;
        delete extraData.updatedBy;
        const serialized = {
          ...extraData,
          version: database.version || '1.0',
          lastUpdated: database.lastUpdated || new Date().toISOString(),
          firebaseKeyEncoding: 1,
          gruposOrden: (database.grupos || []).map(group => String(group.id)),
          grupos: this._toRecordMap(database.grupos, 'grupos'),
          equiposOrden: (database.equipos || []).map(team => String(team.id)),
          equipos: this._toRecordMap(database.equipos, 'equipos')
        };
        return this._encodeFirebaseKeys(serialized);
      },

      _orderedRecords(records, order) {
        const byId = new Map(Object.values(records || {}).map(record => [String(record.id), record]));
        const ordered = (Array.isArray(order) ? order : []).map(id => byId.get(String(id))).filter(Boolean);
        const included = new Set(ordered.map(record => String(record.id)));
        Object.values(records || {}).forEach(record => {
          if (!included.has(String(record.id))) ordered.push(record);
        });
        return ordered;
      },

      _deserializeDatabase(remoteData) {
        if (remoteData.firebaseKeyEncoding === 1) remoteData = this._decodeFirebaseKeys(remoteData);
        const records = value => Array.isArray(value) ? value : Object.values(value || {});
        const groups = records(remoteData.grupos);
        const teams = records(remoteData.equipos);
        const database = { ...remoteData };
        delete database.gruposOrden;
        delete database.equiposOrden;
        delete database.updatedBy;
        return {
          ...database,
          version: database.version || '1.0',
          lastUpdated: database.lastUpdated || new Date().toISOString(),
          grupos: this._orderedRecords(
            Object.fromEntries(groups.map(record => [String(record.id), record])),
            remoteData.gruposOrden
          ),
          equipos: this._orderedRecords(
            Object.fromEntries(teams.map(record => [String(record.id), record])),
            remoteData.equiposOrden
          )
        };
      },

      _normalizeImportedDatabase(imported) {
        let database = imported?.appData && typeof imported.appData === 'object'
          ? imported.appData
          : imported;
        if (!database || typeof database !== 'object' || Array.isArray(database)) {
          throw new Error('El archivo debe contener un objeto JSON con la propiedad "grupos".');
        }

        const isRecordCollection = value => Array.isArray(value) ||
          (value !== null && typeof value === 'object');
        if (!isRecordCollection(database.grupos) ||
          (database.equipos !== undefined && !isRecordCollection(database.equipos))) {
          const groupsType = Array.isArray(database.grupos)
            ? 'arreglo'
            : database.grupos === null ? 'nulo' : typeof database.grupos;
          const teamsType = Array.isArray(database.equipos)
            ? 'arreglo'
            : database.equipos === undefined ? 'ausente'
              : database.equipos === null ? 'nulo' : typeof database.equipos;
          throw new Error(`El JSON debe contener "grupos" como arreglo o mapa y "equipos" como arreglo o mapa opcional (detectado: grupos=${groupsType}, equipos=${teamsType}).`);
        }

        for (const collectionName of ['grupos', 'equipos']) {
          const collection = database[collectionName];
          if (collection === undefined) {
            database[collectionName] = [];
            continue;
          }
          const records = Array.isArray(collection)
            ? collection.map(record => [null, record])
            : Object.entries(collection);
          records.forEach(([key, record]) => {
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
              throw new Error(`El registro "${key ?? ''}" de "${collectionName}" no tiene un objeto válido.`);
            }
            if (record.id === undefined || record.id === null || record.id === '') {
              if (key === null) {
                throw new Error(`Un registro de "${collectionName}" no tiene identificador.`);
              }
              record.id = key;
            }
          });
        }

        return this._deserializeDatabase(database);
      },

      _stable(value) {
        if (Array.isArray(value)) return `[${value.map(item => this._stable(item)).join(',')}]`;
        if (value && typeof value === 'object') {
          return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${this._stable(value[key])}`).join(',')}}`;
        }
        return JSON.stringify(value);
      },

      // [OPT] Comparación barata de dos objetos. Primero se usa el
      // serializador nativo de JavaScript (C++, muy rápido); solo si las
      // claves están en otro orden se cae al análisis estable recursivo.
      _iguales(a, b) {
        if (a === b) return true;
        if (a === null || a === undefined || b === null || b === undefined) return false;
        try {
          if (JSON.stringify(a) === JSON.stringify(b)) return true;
        } catch (error) {
          // Objeto circular: se compara de forma estable más abajo.
        }
        return this._stable(a) === this._stable(b);
      },

      // [OPT] ¿El estado local coincide con lo último sincronizado?
      // Antes este chequeo se hacía de forma estable DOS veces por cada
      // evento remoto (recorrido completo de toda la base con construcción
      // de cadenas). Ahora se intenta con JSON nativo y el "hash" estable
      // del snapshot se memoriza mientras no cambie de referencia.
      _localLimpio() {
        if (!this._syncSnapshot) return true;
        const local = this._serializeDatabase(this.db);
        try {
          if (JSON.stringify(local) === JSON.stringify(this._syncSnapshot)) return true;
        } catch (error) {
          // Si no se puede serializar, se recurre al análisis estable.
        }
        if (this._syncStableFor !== this._syncSnapshot) {
          this._syncStableFor = this._syncSnapshot;
          this._syncStableValue = this._stable(this._syncSnapshot);
        }
        return this._stable(local) === this._syncStableValue;
      },

      // [OPT] Las actualizaciones remotas llegan en ráfaga (un evento por
      // registro). En lugar de reconstruir la vista en cada una, se agrupan
      // en un único render diferido y sin pantalla de carga.
      _notificarCambio() {
        if (typeof UI === 'undefined') return;
        if (!document.getElementById('workspace')?.children.length) return;
        if (typeof UI.programarRender === 'function') UI.programarRender();
        else if (typeof UI.renderCurrentModule === 'function') UI.renderCurrentModule();
      },

      _subscribeToChanges(database) {
        this._listeners.forEach(({ reference, event, callback }) => reference.off(event, callback));
        this._listeners = [];
        ['grupos', 'equipos'].forEach(collection => {
          const reference = this._centerDataReference(database).child(collection);
          const events = {
            child_added: snapshot => this._applyRemoteRecord(collection, snapshot, false),
            child_changed: snapshot => this._applyRemoteRecord(collection, snapshot, false),
            child_removed: snapshot => this._applyRemoteRecord(collection, snapshot, true)
          };
          Object.entries(events).forEach(([event, callback]) => {
            reference.on(event, callback);
            this._listeners.push({ reference, event, callback });
          });
        });
        ['gruposOrden', 'equiposOrden'].forEach(orderKey => {
          const reference = this._centerDataReference(database).child(orderKey);
          const callback = snapshot => this._applyRemoteOrder(
            orderKey === 'gruposOrden' ? 'grupos' : 'equipos',
            snapshot.val()
          );
          reference.on('value', callback);
          this._listeners.push({ reference, event: 'value', callback });
        });
        ['informe', 'cuadernoConfig'].forEach(key => {
          const reference = this._centerDataReference(database).child(key);
          const settingsChanged = snapshot => this._applyRemoteSettings(key, snapshot.val());
          reference.on('value', settingsChanged);
          this._listeners.push({ reference, event: 'value', callback: settingsChanged });
        });
      },

      _applyRemoteSettings(key, value) {
        if (this._keyEncodingVersion === 1 && value !== null) value = this._decodeFirebaseKeys(value);
        // [OPT] Si el valor remoto es idéntico al local no se recorre toda la base.
        if (this._iguales(this.db[key] ?? null, value ?? null)) return;
        if (!this._localLimpio()) return;
        if (value === null) delete this.db[key];
        else this.db[key] = value;
        this._syncSnapshot = this._clone(this._serializeDatabase(this.db));
        this._notificarCambio();
      },

      _applyRemoteOrder(collection, order) {
        const records = this.db[collection] || [];
        const ordered = this._orderedRecords(
          Object.fromEntries(records.map(record => [String(record.id), record])),
          order
        );
        // [OPT] Si el orden remoto no altera nada, salimos sin serializar la base.
        if (this._iguales(records, ordered)) return;
        if (!this._localLimpio()) return;
        this.db[collection] = ordered;
        this._syncSnapshot = this._clone(this._serializeDatabase(this.db));
        this._notificarCambio();
      },

      _applyRemoteRecord(collection, snapshot, removed) {
        const collectionName = collection === 'grupos' ? 'grupos' : 'equipos';
        const records = this.db[collectionName];
        const storedRecord = snapshot.val();
        const record = this._keyEncodingVersion === 1 ? this._decodeFirebaseKeys(storedRecord) : storedRecord;
        const recordId = String(record?.id || snapshot.key);
        const index = records.findIndex(item => String(item.id) === recordId);

        // [OPT] Si el registro remoto ya coincide con el local no hay nada
        // que aplicar. Al arrancar Firebase emite un child_added por cada
        // registro: antes eso disparaba un recorrido completo de la base
        // (dos veces) por cada evento; ahora sale por el camino corto.
        if (!removed && index >= 0 && this._iguales(records[index], record)) return;
        if (removed && index < 0) return;
        // Solo cuando el registro realmente cambió se verifica si hay
        // cambios locales sin guardar que deban protegerse.
        if (!this._localLimpio()) return;

        if (removed) {
          records.splice(index, 1);
        } else if (index >= 0) {
          records[index] = record;
        } else {
          records.push(record);
        }

        this._syncSnapshot = this._clone(this._serializeDatabase(this.db));
        this._notificarCambio();
      },

      // [NUEVO] Garantiza que las bases de datos antiguas (guardadas antes del
      // módulo de Equipos Innovatec/Hackathon) tengan la propiedad "equipos"
      // sin romper nada de lo que ya existía.
      _migrarEsquema() {
        if (!this.db || typeof this.db !== 'object') this.db = {};
        if (!Array.isArray(this.db.grupos)) this.db.grupos = [];
        if (!Array.isArray(this.db.equipos)) this.db.equipos = [];
        this.db.equipos = this.db.equipos.map(eq => ({
          ...eq,
          integrantes: Array.isArray(eq.integrantes) ? eq.integrantes : [],
          archivos: Array.isArray(eq.archivos) ? eq.archivos : [],
          categoria: eq.categoria === 'Hackathon' ? 'Hackathon' : 'Innovatec'
        }));
        // [NUEVO] Asegura que todo grupo tenga el campo docenteGuia, aunque
        // sea de una DB vieja cargada antes de este cambio.
        (this.db.grupos || []).forEach(g => { if (g.docenteGuia === undefined) g.docenteGuia = ''; });
      },

      async _mutateGroupAndSave(grupoId, mutate) {
        const grupo = this.getGrupoById(grupoId);
        if (!grupo) return null;
        const previous = this._clone(grupo);
        try {
          mutate(grupo);
          await this.save();
          return grupo;
        } catch (error) {
          if (this.getGrupoById(grupoId) === grupo) {
            Object.keys(grupo).forEach(key => delete grupo[key]);
            Object.assign(grupo, previous);
          }
          throw error;
        }
      },

      // [NUEVO] Asigna/actualiza el docente guía de un grupo de clase.
      async guardarDocenteGuia(grupoId, docenteGuia) {
        return this._mutateGroupAndSave(grupoId, grupo => {
          grupo.docenteGuia = (docenteGuia || '').trim();
        });
      },

      async save() {
        if (!AuthManager.user || !this._syncSnapshot) {
          throw new Error('No se guardaron los cambios: no hay una sesión conectada a la base compartida.');
        }
        this.db.lastUpdated = new Date().toISOString();
        const previous = this._syncSnapshot;
        const beforeAttribution = this._serializeDatabase(this.db);
        for (const collection of ['grupos', 'equipos']) {
          const oldRecords = previous[collection] || {};
          const newRecords = beforeAttribution[collection] || {};
          for (const [key, record] of Object.entries(newRecords)) {
            if (this._iguales(oldRecords[key] ?? null, record)) continue;
            const sourceRecord = (this.db[collection] || []).find(item => String(item.id) === key);
            if (sourceRecord) {
              sourceRecord.updatedAt = this.db.lastUpdated;
              sourceRecord.updatedBy = AuthManager.user.uid;
            }
          }
        }
        const next = this._serializeDatabase(this.db);
        const reference = this._centerDataReference();
        try {
          for (const collection of ['grupos', 'equipos']) {
            const oldRecords = previous[collection] || {};
            const newRecords = next[collection] || {};
            const keys = new Set([...Object.keys(oldRecords), ...Object.keys(newRecords)]);
            for (const key of keys) {
              const oldValue = oldRecords[key] ?? null;
              const newValue = newRecords[key] ?? null;
              if (this._iguales(oldValue, newValue)) continue;
              const result = await reference.child(`${collection}/${key}`).transaction(current => {
                const currentValue = current ?? null;
                if (!this._iguales(currentValue, oldValue)) return;
                return newValue;
              }, undefined, false);
              if (!result.committed) {
                throw Object.assign(new Error(`Otro usuario modificó el mismo registro de ${collection}. Se recargarán los datos actuales; vuelve a aplicar tu cambio.`), { code: 'app/write-conflict' });
              }
            }
          }

          for (const collection of ['gruposOrden', 'equiposOrden']) {
            const oldValue = previous[collection] || [];
            const newValue = next[collection] || [];
            if (this._iguales(oldValue, newValue)) continue;
            const result = await reference.child(collection).transaction(current => {
              if (!this._iguales(current || [], oldValue)) return;
              return newValue;
            }, undefined, false);
            if (!result.committed) {
              throw Object.assign(new Error('Otro usuario cambió el orden de los registros. Se actualizará la lista actual.'), { code: 'app/write-conflict' });
            }
          }

          const standardFields = new Set(['grupos', 'equipos', 'gruposOrden', 'equiposOrden', 'version', 'lastUpdated', 'updatedBy']);
          const extraKeys = new Set([
            ...Object.keys(previous).filter(key => !standardFields.has(key)),
            ...Object.keys(next).filter(key => !standardFields.has(key))
          ]);
          for (const key of extraKeys) {
            if (/[.#$\[\]/]/.test(key)) throw new Error(`El campo "${key}" no es válido para Firebase Realtime Database.`);
            const oldValue = previous[key] ?? null;
            const newValue = next[key] ?? null;
            if (this._iguales(oldValue, newValue)) continue;
            const result = await reference.child(key).transaction(current => {
              if (!this._iguales(current ?? null, oldValue)) return;
              return newValue;
            }, undefined, false);
            if (!result.committed) {
              throw Object.assign(new Error('Otro usuario modificó esta configuración. Se recargarán los datos actuales; vuelve a aplicar tu cambio.'), { code: 'app/write-conflict' });
            }
          }

          const metadata = {
            version: next.version,
            lastUpdated: this.db.lastUpdated,
            updatedBy: AuthManager.user.uid
          };
          await reference.update(metadata);
          this._syncSnapshot = this._clone(next);
          return true;
        } catch (error) {
          if (error.code === 'app/write-conflict') {
            const latest = await reference.once('value');
            this.db = this._deserializeDatabase(latest.val() || {});
            this._migrarEsquema();
            this._syncSnapshot = this._serializeDatabase(this.db);
            this._notificarCambio();
          }
          console.error('Falló el guardado en Firebase Realtime Database:', error);
          UI?.showToast(`❌ ${error.message || 'No se pudieron guardar los cambios en Firebase.'}`);
          throw error;
        }
      },

      async importDBJSON(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = '';
        if (AuthManager.profile?.role !== 'admin') {
          UI.showToast('❌ Solo un administrador puede reemplazar la base compartida.');
          return;
        }
        if (!window.confirm('Esta acción reemplazará toda la base compartida de Firebase. ¿Deseas continuar?')) return;
        let databaseCommitted = false;
        const previousDatabase = this.db;
        const previousSnapshot = this._syncSnapshot;
        try {
          const imported = JSON.parse(await file.text());
          this.db = this._normalizeImportedDatabase(imported);
          this._migrarEsquema();
          this._serializeDatabase(this.db);
          const normalized = this._serializeDatabase(this.db);
          const payload = { ...normalized, updatedBy: AuthManager.user.uid };
          await this._centerDataReference().set(payload);
          databaseCommitted = true;
          this._syncSnapshot = this._clone(normalized);
          this._subscribeToChanges(window.FirebaseServices.database);
          UI.showToast(`✅ Base guardada en Realtime Database: ${this.db.grupos.length} grupo(s) y ${this.db.equipos.length} equipo(s).`);
          UI.renderCurrentModule();
          try {
            await this.migrateLegacyAttachments();
          } catch (migrationError) {
            console.error('La base se importó, pero no se pudieron migrar todos los adjuntos:', migrationError);
            UI.showToast(`⚠️ La base se importó, pero falló la migración de adjuntos: ${migrationError.message}`);
          }
        } catch (error) {
          if (!databaseCommitted) {
            this.db = previousDatabase;
            this._syncSnapshot = previousSnapshot;
          }
          console.error('Error al importar la base compartida:', error);
          UI.showToast(`❌ No se pudo importar la base en Realtime Database: ${error.message}`);
        }
      },

      async uploadAttachment(teamId, file, metadata) {
        if (!AuthManager.user || !window.FirebaseServices?.storage) {
          throw new Error('Inicia sesión antes de subir archivos.');
        }
        if (teamId === undefined || teamId === null || metadata?.id === undefined || metadata.id === null ||
          /[.#$\[\]/]/.test(String(teamId)) || /[.#$\[\]/]/.test(String(metadata.id))) {
          throw new Error('El equipo o archivo tiene un identificador no válido para Storage.');
        }
        const safeName = file.name.replace(/[.#$\[\]/\\]/g, '_');
        const storagePath = `team-attachments/${AuthManager.user.uid}/${teamId}/${metadata.id}/${safeName}`;
        const reference = window.FirebaseServices.storage.ref(storagePath);
        await reference.put(file, {
          contentType: file.type || 'application/octet-stream',
          customMetadata: {
            teamId: String(teamId),
            uploadedBy: AuthManager.user.uid
          }
        });
        return {
          ...metadata,
          storagePath,
          uploadedBy: AuthManager.user.uid,
          contentType: file.type || 'application/octet-stream'
        };
      },

      getAttachmentOwner(attachmentOrPath) {
        const storagePath = typeof attachmentOrPath === 'string'
          ? attachmentOrPath
          : attachmentOrPath?.storagePath;
        const match = typeof storagePath === 'string'
          ? storagePath.match(/^team-attachments\/([^/]+)\//)
          : null;
        if (match) return match[1];
        return attachmentOrPath && typeof attachmentOrPath === 'object' &&
          typeof attachmentOrPath.uploadedBy === 'string'
          ? attachmentOrPath.uploadedBy
          : null;
      },

      canManageAttachment(attachmentOrPath) {
        const uid = AuthManager.user?.uid;
        return Boolean(uid && this.getAttachmentOwner(attachmentOrPath) === uid);
      },

      async deleteStoredFile(storagePath) {
        if (!storagePath) return;
        if (!this.canManageAttachment(storagePath)) {
          throw new Error('Solo la cuenta que subió este archivo puede eliminarlo.');
        }
        await window.FirebaseServices.storage.ref(storagePath).delete();
      },

      async migrateLegacyAttachments() {
        if (AuthManager.profile?.role !== 'admin') return;
        for (const team of this.db.equipos || []) {
          const migrated = [];
          let databaseSaveStarted = false;
          try {
            for (const attachment of team.archivos || []) {
              if (!attachment.dataUrl || attachment.storagePath) continue;
              const response = await fetch(attachment.dataUrl);
              if (!response.ok) throw new Error(`No se pudo recuperar el adjunto antiguo "${attachment.nombre}".`);
              const blob = await response.blob();
              const file = new File([blob], attachment.nombre, { type: attachment.contentType || blob.type });
              const stored = await this.uploadAttachment(team.id, file, attachment);
              migrated.push({ attachment, original: this._clone(attachment), storagePath: stored.storagePath });
              delete attachment.dataUrl;
              Object.assign(attachment, stored);
            }
            if (migrated.length > 0) {
              databaseSaveStarted = true;
              await this.save();
            }
          } catch (error) {
            migrated.forEach(({ attachment, original }) => {
              Object.keys(attachment).forEach(key => {
                if (!(key in original)) delete attachment[key];
              });
              Object.assign(attachment, original);
            });
            if (!databaseSaveStarted) {
              const cleanupResults = await Promise.allSettled(migrated.map(({ storagePath }) => this.deleteStoredFile(storagePath)));
              cleanupResults.forEach(result => {
                if (result.status === 'rejected') console.error('No se pudo limpiar un adjunto durante su migración:', result.reason);
              });
            } else if (migrated.length > 0) {
              console.error('Los adjuntos subidos se conservaron porque no se pudo confirmar si sus referencias llegaron a guardarse.');
            }
            throw error;
          }
        }
      },

      exportDBJSON() {
        try {
          const blob = new Blob([JSON.stringify(this.db, null, 2)], { type: 'application/json' });
          const dataUrl = URL.createObjectURL(blob);
          const downloadAnchor = document.createElement('a');
          const fecha = new Date().toISOString().slice(0, 10);
          downloadAnchor.setAttribute("href", dataUrl);
          downloadAnchor.setAttribute("download", `TIC_Dashboard_DB_${fecha}.json`);
          document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
          URL.revokeObjectURL(dataUrl);
          UI.showToast("💾 Base de datos descargada correctamente.");
        } catch (error) { console.error("Error al exportar:", error); UI.showToast("❌ Error al descargar el archivo JSON."); }
      },

      getGrupos() { return this.db.grupos || []; },
      getGrupoById(grupoId) { return this.getGrupos().find(g => g.id === grupoId); },
      getEstudiantesByGrupo(grupoId) { const grupo = this.getGrupoById(grupoId); return grupo ? (grupo.estudiantes || []) : []; },

      getEstudiantes() {
        let all = [];
        this.getGrupos().forEach(g => {
          if (Array.isArray(g.estudiantes)) {
            g.estudiantes.forEach(e => { all.push({ ...e, grupoId: g.id, grupoNombre: g.nombre }); });
          }
        });
        return all;
      },

      getEstudianteById(estudianteId) {
        for (const g of this.getGrupos()) { const e = (g.estudiantes || []).find(est => est.id === estudianteId); if (e) return e; }
        return null;
      },

      // [NUEVO] Accesores para el módulo de Equipos Innovatec / Hackathon
      getEquipos() { return this.db.equipos || []; },
      getEquipoById(equipoId) { return this.getEquipos().find(eq => eq.id === equipoId); },

      // [NUEVO] Grupo de clase asociado a un equipo (el equipo guarda solo
      // el grupoClaseId; el docente guía se toma del propio grupo).
      getGrupoClaseDeEquipo(eq) {
        if (!eq || !eq.grupoClaseId) return null;
        return this.getGrupoById(eq.grupoClaseId) || null;
      },

      abrirModalConvalidaciones() {
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        if (!grupoId) { UI.showToast("⚠️ Seleccione primero un grupo."); return; }
        const estudiantes = DataEngine.getEstudiantesByGrupo(grupoId);
        const selectEst = document.getElementById('select-estudiante-convalidar');
        const selectMod = document.getElementById('select-modulo-convalidar');
        if (!selectEst || !selectMod) { console.error("No se encontraron los elementos select del modal."); return; }
        // [OPT] Construir el HTML por concatenación interna en vez de
        // re-analizar el <select> completo en cada iteración.
        const opcionesEst = ['<option value="">-- Seleccionar Estudiante --</option>'];
        estudiantes.forEach(e => { opcionesEst.push(`<option value="${e.id}">${e.apellidos}, ${e.nombres}</option>`); });
        selectEst.innerHTML = opcionesEst.join('');
        const opcionesMod = ['<option value="">-- Seleccionar Módulo --</option>'];
        MODULOS_TRANSVERSALES.forEach(m => { opcionesMod.push(`<option value="${m}">${m}</option>`); });
        selectMod.innerHTML = opcionesMod.join('');
        this.renderTablaConvalidaciones(grupoId);
        const modal = document.getElementById('modal-convalidaciones');
        if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
      },

      renderTablaConvalidaciones(grupoId) {
        const tbody = document.getElementById('tbody-convalidaciones-lista');
        if (!tbody) return;
        const estudiantes = DataEngine.getEstudiantesByGrupo(grupoId);
        let htmlRows = '';
        estudiantes.forEach(est => {
          if (est.convalidaciones && Object.keys(est.convalidaciones).length > 0) {
            Object.entries(est.convalidaciones).forEach(([modulo, estaConvalidado]) => {
              if (estaConvalidado) {
                htmlRows += `<tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 12px;"><strong>${est.apellidos}</strong>, ${est.nombres}</td><td style="padding: 8px 12px;"><span class="badge-modulo">${modulo}</span></td><td style="padding: 8px 12px; text-align: center;"><button class="btn-icon" title="Quitar convalidación" style="color: #dc3545;" onclick="DataEngine.eliminarConvalidacion('${est.id}', '${modulo}', '${grupoId}')"><i class="ri-delete-bin-line"></i></button></td></tr>`;
              }
            });
          }
        });
        if (htmlRows === '') htmlRows = `<tr><td colspan="3" style="text-align: center; padding: 15px; color: #888;">No hay convalidaciones registradas en este grupo.</td></tr>`;
        tbody.innerHTML = htmlRows;
      },

      async eliminarConvalidacion(estudianteId, modulo, grupoId) {
        if (!confirm(`¿Está seguro de eliminar la convalidación del módulo "${modulo}" para este estudiante?`)) return;
        const estudiantes = this.getEstudiantesByGrupo(grupoId);
        const est = estudiantes.find(e => e.id === estudianteId);
        if (est && est.convalidaciones && est.convalidaciones[modulo]) {
          try {
            await this._mutateGroupAndSave(grupoId, grupo => {
              const currentStudent = (grupo.estudiantes || []).find(item => item.id === estudianteId);
              if (currentStudent?.convalidaciones) delete currentStudent.convalidaciones[modulo];
            });
          } catch (error) {
            console.error('No se pudo eliminar la convalidación:', error);
            return;
          }
          UI.showToast("🗑️ Convalidación eliminada correctamente.");
          this.renderTablaConvalidaciones(grupoId);
          if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
        }
      },

      async guardarConvalidacion() {
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        const estudianteId = document.getElementById('select-estudiante-convalidar')?.value;
        const moduloNombre = document.getElementById('select-modulo-convalidar')?.value;
        if (!grupoId) { UI.showToast("⚠️ No hay grupo seleccionado."); return; }
        if (!estudianteId || !moduloNombre) { UI.showToast("⚠️ Seleccione el estudiante y el módulo."); return; }
        // Buscar SOLO dentro del grupo activo para evitar IDs duplicados entre grupos
        const estudiante = DataEngine.getEstudiantesByGrupo(grupoId).find(e => e.id === estudianteId);
        if (estudiante) {
          try {
            await this._mutateGroupAndSave(grupoId, grupo => {
              const currentStudent = (grupo.estudiantes || []).find(item => item.id === estudianteId);
              if (!currentStudent) throw new Error('El estudiante ya no pertenece a este grupo.');
              if (!currentStudent.convalidaciones) currentStudent.convalidaciones = {};
              currentStudent.convalidaciones[moduloNombre] = true;
            });
          } catch (error) {
            console.error('No se pudo guardar la convalidación:', error);
            return;
          }
          UI.showToast(`✅ Módulo "${moduloNombre}" convalidado para ${estudiante.nombres}.`);
          UI.cerrarModalConvalidaciones();
          if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
        }
      },

      // [NUEVO] Borra TODAS las notas cargadas de un módulo para el grupo activo
      // (evaluacionesPorModulo de cada estudiante + la estructura de columnas
      // guardada). No toca las convalidaciones ni el estado del estudiante.
      async borrarDatosModulo() {
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        const moduloSeleccionado = document.getElementById('select-modulo-cuaderno')?.value;
        if (!grupoId) { UI.showToast("⚠️ Seleccione primero un grupo."); return; }
        if (!moduloSeleccionado || moduloSeleccionado === 'ALL') { UI.showToast("⚠️ Seleccione el módulo específico que desea borrar."); return; }
        if (!confirm(`¿Está seguro de borrar TODAS las notas cargadas del módulo "${moduloSeleccionado}" para este grupo? Esta acción no se puede deshacer.`)) return;

        const grupo = this.getGrupoById(grupoId);
        if (!grupo) return;

        try {
          await this._mutateGroupAndSave(grupoId, currentGroup => {
            (currentGroup.estudiantes || []).forEach(est => {
              if (est.evaluacionesPorModulo && est.evaluacionesPorModulo[moduloSeleccionado]) {
                delete est.evaluacionesPorModulo[moduloSeleccionado];
              }
            });
            if (currentGroup.estructuraModulos && currentGroup.estructuraModulos[moduloSeleccionado]) {
              delete currentGroup.estructuraModulos[moduloSeleccionado];
            }
          });
        } catch (error) {
          console.error('No se pudieron borrar los datos del módulo:', error);
          return;
        }
        UI.showToast(`🗑️ Datos del módulo "${moduloSeleccionado}" borrados correctamente.`);
        if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
      },

      // [NUEVO] Elimina UNA columna (evaluación) puntual de un módulo: la
      // quita de la estructura guardada y de las notas de cada estudiante.
      async eliminarColumnaModulo(moduloSeleccionado, nombreColumna) {
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        if (!grupoId) { UI.showToast("⚠️ Seleccione primero un grupo."); return; }
        if (!moduloSeleccionado || !nombreColumna) return;
        if (!confirm(`¿Eliminar la columna "${nombreColumna}" del módulo "${moduloSeleccionado}" para todos los estudiantes de este grupo?`)) return;

        const grupo = this.getGrupoById(grupoId);
        if (!grupo) return;

        try {
          await this._mutateGroupAndSave(grupoId, currentGroup => {
            (currentGroup.estudiantes || []).forEach(est => {
              const modData = est.evaluacionesPorModulo ? est.evaluacionesPorModulo[moduloSeleccionado] : null;
              if (modData) {
                if (modData.notas && modData.notas[nombreColumna] !== undefined) delete modData.notas[nombreColumna];
                if (modData.evaluaciones && modData.evaluaciones[nombreColumna] !== undefined) delete modData.evaluaciones[nombreColumna];
                if (modData.totalesUnidad && modData.totalesUnidad[nombreColumna] !== undefined) delete modData.totalesUnidad[nombreColumna];
              }
            });
            if (currentGroup.estructuraModulos && currentGroup.estructuraModulos[moduloSeleccionado]) {
              const config = currentGroup.estructuraModulos[moduloSeleccionado];
              if (Array.isArray(config.columnasOrdenadas)) {
                config.columnasOrdenadas = config.columnasOrdenadas.filter(c => c.nombreDisplay !== nombreColumna);
              }
            }
          });
        } catch (error) {
          console.error('No se pudo eliminar la columna del módulo:', error);
          return;
        }
        UI.showToast(`🗑️ Columna "${nombreColumna}" eliminada correctamente.`);
        if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
      },

      getListaConvalidaciones() {
        const lista = [];
        (this.db.grupos || []).forEach(grupo => {
          (grupo.estudiantes || []).forEach(est => {
            if (est.convalidaciones && Object.keys(est.convalidaciones).length > 0) {
              Object.entries(est.convalidaciones).forEach(([modulo, estaConvalidado]) => {
                if (estaConvalidado) lista.push({ grupoId: grupo.id, grupoNombre: grupo.nombre, estudianteId: est.id, nombres: est.nombres, apellidos: est.apellidos, modulo: modulo });
              });
            }
          });
        });
        return lista;
      },

      parseExcelGroup(file, callback) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const previousGroups = DataEngine.db.grupos;
          const previousGroupsSnapshot = previousGroups.slice();
          try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          let grupoId = "GRUPO-" + Math.floor(Math.random() * 1000);
          let carrera = "TÉCNICO GENERAL";
          let turno = "General";

          for (let r = 0; r < Math.min(12, rawData.length); r++) {
            const row = rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim();
              if (val === 'Grupo:') grupoId = String(row[c + 3] || grupoId).trim();
              if (val === 'Evento:') carrera = String(row[c + 3] || carrera).trim();
              if (val === 'Turno:') turno = String(row[c + 1] || turno).trim();
            }
          }

          const estudiantes = [];
          for (let r = 12; r < rawData.length; r++) {
            const row = rawData[r] || [];
            const nombreCompleto = String(row[7] || '').trim();
            const estadoRaw = String(row[16] || '').trim();
            if (nombreCompleto && nombreCompleto !== 'NOMBRE DEL PARTICIPANTE') {
              const parts = nombreCompleto.split(/\s+/);
              let nombres = "", apellidos = "";
              if (parts.length >= 4) { nombres = parts.slice(0, 2).join(' '); apellidos = parts.slice(2).join(' '); }
              else if (parts.length === 3) { nombres = parts[0]; apellidos = parts.slice(1).join(' '); }
              else if (parts.length === 2) { nombres = parts[0]; apellidos = parts[1]; }
              else { nombres = nombreCompleto; apellidos = "---"; }
              const telefono = String(row[20] || 'Sin teléfono').trim();
              const correo = String(row[26] || 'sin.correo@tecnacional.edu.ni').trim();
              const estado = estadoRaw.toLowerCase().includes('retirado') ? 'Retirado' : 'Activo';
              estudiantes.push({ id: 'STU-' + (estudiantes.length + 1).toString().padStart(3, '0'), nombres, apellidos, correo, telefono: telefono === 'undefined' ? 'Sin teléfono' : telefono, estado });
            }
          }

          const existingIdx = DataEngine.db.grupos.findIndex(g => g.id === grupoId);
          const newGroupData = { id: grupoId, codigo: grupoId, nombre: grupoId, carrera, turno, estudiantes, estructuraModulos: {} };

          if (existingIdx >= 0) {
            const existing = DataEngine.db.grupos[existingIdx];
            const existingEvals = {};
            const existingConvs = {};
            (existing.estudiantes || []).forEach(oldE => {
              const key = `${oldE.nombres}|${oldE.apellidos}|${oldE.correo}`;
              if (oldE.evaluacionesPorModulo) existingEvals[key] = oldE.evaluacionesPorModulo;
              if (oldE.convalidaciones) existingConvs[key] = oldE.convalidaciones;
            });
            newGroupData.estudiantes.forEach(newE => {
              const key = `${newE.nombres}|${newE.apellidos}|${newE.correo}`;
              if (existingEvals[key]) newE.evaluacionesPorModulo = existingEvals[key];
              if (existingConvs[key]) newE.convalidaciones = existingConvs[key];
            });
            newGroupData.estructuraModulos = existing.estructuraModulos || {};
            DataEngine.db.grupos[existingIdx] = { ...existing, ...newGroupData };
          } else {
            DataEngine.db.grupos.push(newGroupData);
          }

          await DataEngine.save();
          callback(newGroupData);
          } catch (error) {
            if (DataEngine.db.grupos === previousGroups) DataEngine.db.grupos = previousGroupsSnapshot;
            console.error('No se pudo importar el grupo desde Excel:', error);
            UI.showToast(`❌ No se pudo importar el grupo: ${error.message}`);
          }
        };
        reader.onerror = error => {
          console.error('No se pudo leer el archivo Excel del grupo:', error);
          UI.showToast('❌ No se pudo leer el archivo Excel.');
        };
        reader.readAsArrayBuffer(file);
      }
    };
