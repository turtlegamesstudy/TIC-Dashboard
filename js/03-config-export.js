'use strict';
    const ConfigExport = {
      STORAGE_KEY: 'TIC_EXPORT_CONFIG',

      storageKey() {
        const uid = AuthManager.user?.uid;
        const centerId = AuthManager.activeCenterId || AuthManager.profile?.centerId;
        return uid && centerId
          ? `${this.STORAGE_KEY}:${encodeURIComponent(centerId)}:${encodeURIComponent(uid)}`
          : this.STORAGE_KEY;
      },

      defaults: {
        fontFamily: 'Arial',
        fontSize: 14,
        textColor: '#000000',
        bold: true,
        borderColor: '#000000',
        headerBg: true,
        headerColor: '#F5F5F5',
        dataBg: false,
        colA: 510,
        colB: 2040,
        colC: 2600,
        colNotes: 1040,
        rowHeaderMain: 170,
        rowHeaderMod: 160,
        rowData: 20,
        rowFirma: 80,
        titleInatec: 18,
        titleCentro: 16,
        titleReporte: 15,

        // Impresión
        printOrientation: 'landscape',   // 'landscape' | 'portrait'
        printFitToPage: true,            // ajustar ancho y alto a 1 página
        printCentered: true,             // centrar horizontal y verticalmente
        printMargin: 'estrecho'          // 'estrecho' | 'normal' | 'ancho'
      },

      // Presets de márgenes en pulgadas, igual que Excel
      MARGIN_PRESETS: {
        estrecho: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        normal:   { left: 0.7,  right: 0.7,  top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        ancho:    { left: 1,    right: 1,    top: 1,    bottom: 1,    header: 0.5, footer: 0.5 }
      },

      load() {
        const key = this.storageKey();
        let saved = localStorage.getItem(key);
        if (!saved && key !== this.STORAGE_KEY) {
          saved = localStorage.getItem(this.STORAGE_KEY);
          if (saved) {
            localStorage.setItem(key, saved);
            localStorage.removeItem(this.STORAGE_KEY);
          }
        }
        try {
          return saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults };
        } catch (error) {
          console.error('La configuración de exportación guardada no es válida:', error);
          return { ...this.defaults };
        }
      },

      save(cfg) {
        localStorage.setItem(this.storageKey(), JSON.stringify(cfg));
      },

      resetDefaults() {
        localStorage.removeItem(this.storageKey());
        this.poblarFormulario();
        UI.showToast("🔄 Configuración restaurada a valores predeterminados.");
      },

      poblarFormulario() {
        const cfg = this.load();
        document.getElementById('cfg-font-family').value = cfg.fontFamily;
        document.getElementById('cfg-font-size').value = cfg.fontSize;
        document.getElementById('cfg-text-color').value = cfg.textColor;
        document.getElementById('cfg-bold').checked = cfg.bold;
        document.getElementById('cfg-border-color').value = cfg.borderColor;
        document.getElementById('cfg-header-bg').checked = cfg.headerBg;
        document.getElementById('cfg-header-color').value = cfg.headerColor;
        document.getElementById('cfg-data-bg').checked = cfg.dataBg;
        document.getElementById('cfg-col-a').value = cfg.colA;
        document.getElementById('cfg-col-b').value = cfg.colB;
        document.getElementById('cfg-col-c').value = cfg.colC;
        document.getElementById('cfg-col-notes').value = cfg.colNotes;
        document.getElementById('cfg-row-header-main').value = cfg.rowHeaderMain;
        document.getElementById('cfg-row-header-mod').value = cfg.rowHeaderMod;
        document.getElementById('cfg-row-data').value = cfg.rowData;
        document.getElementById('cfg-row-firma').value = cfg.rowFirma;
        document.getElementById('cfg-title-inatec').value = cfg.titleInatec;
        document.getElementById('cfg-title-centro').value = cfg.titleCentro;
        document.getElementById('cfg-title-reporte').value = cfg.titleReporte;

        document.getElementById('cfg-print-orientation').value = cfg.printOrientation;
        document.getElementById('cfg-print-fit').checked = cfg.printFitToPage;
        document.getElementById('cfg-print-centered').checked = cfg.printCentered;
        document.getElementById('cfg-print-margin').value = cfg.printMargin;
      },

      guardar() {
        const cfg = {
          fontFamily: document.getElementById('cfg-font-family').value,
          fontSize: parseInt(document.getElementById('cfg-font-size').value) || 14,
          textColor: document.getElementById('cfg-text-color').value,
          bold: document.getElementById('cfg-bold').checked,
          borderColor: document.getElementById('cfg-border-color').value,
          headerBg: document.getElementById('cfg-header-bg').checked,
          headerColor: document.getElementById('cfg-header-color').value,
          dataBg: document.getElementById('cfg-data-bg').checked,
          colA: parseInt(document.getElementById('cfg-col-a').value) || 510,
          colB: parseInt(document.getElementById('cfg-col-b').value) || 2040,
          colC: parseInt(document.getElementById('cfg-col-c').value) || 2600,
          colNotes: parseInt(document.getElementById('cfg-col-notes').value) || 1040,
          rowHeaderMain: parseInt(document.getElementById('cfg-row-header-main').value) || 170,
          rowHeaderMod: parseInt(document.getElementById('cfg-row-header-mod').value) || 160,
          rowData: parseInt(document.getElementById('cfg-row-data').value) || 20,
          rowFirma: parseInt(document.getElementById('cfg-row-firma').value) || 80,
          titleInatec: parseInt(document.getElementById('cfg-title-inatec').value) || 18,
          titleCentro: parseInt(document.getElementById('cfg-title-centro').value) || 16,
          titleReporte: parseInt(document.getElementById('cfg-title-reporte').value) || 15,

          printOrientation: document.getElementById('cfg-print-orientation').value,
          printFitToPage: document.getElementById('cfg-print-fit').checked,
          printCentered: document.getElementById('cfg-print-centered').checked,
          printMargin: document.getElementById('cfg-print-margin').value
        };
        this.save(cfg);
        UI.showToast("✅ Configuración de exportación guardada.");
        UI.cerrarModalConfigExport();
      }
    };