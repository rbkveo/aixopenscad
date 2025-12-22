«Геометрический паспорт» — это промежуточный слой данных (structured metadata), который превращает визуальные образы из чертежа в четкие инструкции для OpenSCAD.

Чтобы Vision-модель (gemma3 или Qwen-VL) выдала максимум пользы, ее ответ должен имитировать структуру CSG (Constructive Solid Geometry) — то есть то, как OpenSCAD «думает».

Структура «Геометрического паспорта»
Вот схема, которую нужно передать Vision-модели в качестве системного промпта.

1. Global Context (Глобальный контекст)
Bounding Box: Примерные габариты всей детали [X, Y, Z].

Orientation: Какая плоскость является базовой (например, XY-plane).

Symmetry: Есть ли зеркальная или радиальная симметрия (это позволит модели использовать циклы for или mirror()).

2. Base Primitive (Основная форма)
Type: cube, cylinder или sphere.

Dimensions: Конкретные числа с чертежа.

Alignment: Центрирована ли форма (center=true) или стоит от угла.

3. Positive Features (Добавляемые элементы)
Список элементов, которые объединяются через union():

Feature Type: (например, «Ушко для крепления»).

Shape: Примитив.

Relative Position: Координаты относительно центра базы.

Parameters: Радиусы скруглений, углы наклона.

4. Negative Features (Вычитаемые элементы)
Список элементов для difference():

Holes/Slots: Тип отверстия (сквозное, глухое, паз).

Coordinates: Точки расположения центров.

Pattern: Есть ли массив (например, «4 отверстия по углам с отступом 5мм»).

5. Candidate Parameters (Переменные)
Vision-модель должна пометить числа, которые выглядят как изменяемые параметры:

Пример: wall_thickness, hole_diameter, base_height.

Промпт для Vision-модели (System Prompt)
Используйте этот текст для вашей Gemini/Qwen, когда отправляете ей чертеж:

"Act as a Mechanical Engineer and 3D Perception Expert. Analyze this drawing/sketch and generate a 'Geometric Passport' for OpenSCAD reconstruction.

Follow this JSON structure strictly: { "part_name": "string", "base_geometry": { "shape": "cube|cylinder", "size": [x,y,z], "is_centered": true }, "additions": [ { "feature": "string", "shape": "string", "pos": [x,y,z], "size": [] } ], "subtractions": [ { "feature": "string", "shape": "string", "pos": [x,y,z], "size": [], "pattern": "none|linear|circular" } ], "estimated_parameters": [ { "name": "string", "value": number, "reason": "string" } ], "constraints": ["e.g., holes must be 5mm from edges"] }

Important: Be precise with coordinates. If a dimension is missing, estimate it based on proportions and mark it with an asterisk (*)."

Как это работает в вашем пайплайне:
User загружает картинку и пишет: «Сделай такую деталь, но в два раза выше».

Vision Model получает картинку + промпт выше. Выдает JSON «Паспорта».

Reasoning Model (Devstral) получает:

JSON Паспорта.

Инструкцию пользователя («в два раза выше»).

Vanilla OpenSCAD RAG (ваши сниппеты для скруглений и циклов).

Результат: Код получается невероятно точным, так как модель «видит» координаты из JSON, а не гадает их по описанию.

Почему это лучше обычного чата:
Без такого паспорта ИИ часто ошибается в относительном позиционировании (например, ставит отверстие не по центру грани, а со смещением). Четкая структура pos: [x, y, z] в паспорте заставляет Vision-модель проговорить координаты явно, что резко снижает шанс галлюцинации.