import openpyxl
wb = openpyxl.load_workbook("METODOS Y SOPORTES 2025.xlsx", data_only=True)
print("Notas LEP 2025 headers:")
print([str(x).strip() for x in next(wb['Notas LEP 2025'].iter_rows(values_only=True)) if x])
